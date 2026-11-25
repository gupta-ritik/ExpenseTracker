import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../../lib/auth", () => ({
  requireUser: async () => ({
    id: session.userId,
    name: "Test",
    email: "test@expense.local",
  }),
  session: async () => ({ user: { id: session.userId } }),
  auth: () => ({
    api: {
      getSession: async () =>
        session.userId
          ? {
              user: {
                id: session.userId,
                name: "Test",
                email: "test@expense.local",
              },
            }
          : null,
    },
  }),
}));

import { db } from "../../lib/db";
import { databasePool } from "../../lib/db/connection";
import { user } from "../../lib/db/auth-schema";
import {
  accounts,
  aiUsage,
  holdings,
  importJobs,
  ingestTokens,
  investmentTxns,
  mailConnections,
  merchantRules,
  transactions,
} from "../../lib/db/schema";
import { seedDefaults } from "../../lib/expense/defaults";
import { confirmImport } from "../../lib/expense/import-actions";
import { captureMessages } from "../../lib/capture/messages";
import { importDocument } from "../../lib/capture/documents";
import {
  saveMailConnection,
  syncConnection,
  type ClientFactory,
} from "../../lib/capture/email";
import {
  approveEntry,
  recategorize,
  rejectEntry,
  reviewCount,
  reviewQueue,
} from "../../lib/capture/review";
import {
  createIngestToken,
  listIngestTokens,
  rateLimit,
  revokeIngestToken,
} from "../../lib/capture/tokens";
import { getPortfolio } from "../../lib/capture/investments";
import { getImportJobs } from "../../lib/db/queries/capture";
import { POST as ingestSms } from "../../app/api/ingest/sms/route";
import { loadAlertFixtures } from "../fixtures/alerts/load";
import { loadTestEnvironment } from "../../scripts/test-environment";

const enabled = existsSync(".env.test");
const a = randomUUID();
const b = randomUUID();
const alerts = loadAlertFixtures();
const hdfcUpi = alerts.find((item) => item.file === "hdfc.txt")!;
const sbiUpi = alerts.find((item) => item.file === "sbi.txt")!;
const pdf = (name: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/${name}`));
const sms = (text: string, sender = "VM-HDFCBK") => ({
  text,
  sender,
  receivedAt: new Date("2026-11-25T13:00:00+05:30"),
});
const live = (userId: string) =>
  and(eq(transactions.userId, userId), isNull(transactions.deletedAt));

function fakeImap(messages: { uid: number; source: Buffer }[]): ClientFactory {
  return () => ({
    connect: async () => undefined,
    logout: async () => undefined,
    mailboxOpen: async () => ({}) as never,
    mailbox: { uidValidity: 7n } as never,
    search: async () => messages.map((item) => item.uid),
    fetch: async function* () {
      for (const item of messages)
        yield { uid: item.uid, size: item.source.length, source: item.source };
    } as never,
  });
}

function request(body: unknown, token?: string) {
  return new Request("http://localhost/api/ingest/sms", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

describe.skipIf(!enabled)("automatic capture on the Neon test branch", () => {
  beforeAll(async () => {
    loadTestEnvironment();
    delete process.env.GROQ_API_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    process.env.CRON_SECRET = "c".repeat(40);
    await db()
      .insert(user)
      .values(
        [a, b].map((id) => ({
          id,
          name: "Capture test",
          email: `${id}@expense.local`,
        })),
      );
    await seedDefaults(a);
    await seedDefaults(b);
  }, 30_000);

  afterAll(async () => {
    if (!enabled) return;
    await db()
      .delete(user)
      .where(inArray(user.id, [a, b]));
    await databasePool().end();
  });

  it("dedupes one payment arriving by SMS, email, PDF and CSV into a single row", async () => {
    const first = await captureMessages({
      userId: a,
      source: "sms",
      messages: [sms(hdfcUpi.text)],
    });
    expect(first).toMatchObject({ inserted: 1, duplicates: 0 });

    const eml = (name: string) => readFileSync(`tests/fixtures/emails/${name}`);
    const connectionId = await saveMailConnection(a, {
      host: "imap.example.com",
      port: 993,
      user: "test.user@example.com",
      password: "app-password",
    });
    const [connection] = await db()
      .select()
      .from(mailConnections)
      .where(eq(mailConnections.id, connectionId));
    expect(connection.passwordEnc).not.toContain("app-password");
    const synced = await syncConnection(
      connection,
      Date.now() + 30_000,
      fakeImap([
        { uid: 101, source: eml("hdfc-upi.eml") },
        { uid: 102, source: eml("icici-otp.eml") },
      ]),
    );
    expect(synced).toMatchObject({
      messages: 2,
      inserted: 0,
      duplicates: 1,
      done: true,
    });
    const [after] = await db()
      .select({ lastUid: mailConnections.lastUid })
      .from(mailConnections)
      .where(eq(mailConnections.id, connectionId));
    expect(after.lastUid).toBe(102);

    const [card] = await db()
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, a), eq(accounts.last4, "1234")));
    const statement = await importDocument({
      userId: a,
      data: pdf("pdf/hdfc.pdf"),
      password: "TEST1234",
      fileName: "hdfc.pdf",
      accountId: card.id,
      expected: "statement",
    });
    expect(statement).toMatchObject({ inserted: 4, duplicates: 1 });
    const again = await importDocument({
      userId: a,
      data: pdf("pdf/hdfc.pdf"),
      password: "TEST1234",
      accountId: card.id,
      expected: "statement",
    });
    expect(again).toMatchObject({ inserted: 0, duplicates: 5 });

    session.userId = a;
    const csv =
      "Date,Description,Debit,Credit\n25/11/2026,UPI/433112345678/SWIGGY/swiggy@icici,499.00,\n26/11/2026,UPI/OTHER SHOP,10.00,\n";
    const imported = await confirmImport(
      {
        csv,
        preset: "generic",
        mapping: { date: 0, description: 1, debit: 2, credit: 3 },
      },
      card.id,
    );
    expect(imported).toEqual({ imported: 1, duplicates: 1 });

    expect(
      await db().$count(
        transactions,
        and(live(a), eq(transactions.amountPaise, 49_900)),
      ),
    ).toBe(1);
    const different = await captureMessages({
      userId: a,
      source: "sms",
      messages: [
        sms(
          hdfcUpi.text
            .replace("Rs.499.00", "Rs.500.00")
            .replace("433112345678", "433112345600"),
        ),
      ],
    });
    expect(different.inserted).toBe(1);
  }, 60_000);

  it("rejects a statement that does not reconcile and imports nothing", async () => {
    const before = await db().$count(transactions, live(a));
    const result = await importDocument({
      userId: a,
      data: pdf("pdf/hdfc-bad-reconciliation.pdf"),
      fileName: "bad.pdf",
      expected: "statement",
    });
    expect(result).toMatchObject({ status: "failed" });
    expect("error" in result && result.error).toMatch(
      /Reconciliation failed.*Nothing was imported/,
    );
    expect(await db().$count(transactions, live(a))).toBe(before);
    const [job] = await getImportJobs(a, 1);
    expect(job).toMatchObject({ source: "pdf", status: "failed" });
  }, 30_000);

  it("asks for a PDF password when none is given", async () => {
    const result = await importDocument({
      userId: a,
      data: pdf("pdf/hdfc.pdf"),
      expected: "statement",
    });
    expect(result).toMatchObject({ status: "needs_password" });
  });

  it("routes unknown merchants to review and learns merchant rules", async () => {
    const text =
      "Rs.777.00 spent on HDFC Bank Card 5678 At NEW CORNER CAFE On 2026-11-24:10:00:00";
    const result = await captureMessages({
      userId: a,
      source: "sms",
      messages: [sms(text)],
    });
    expect(result.review).toBe(1);
    const queue = await reviewQueue(a);
    const item = queue.items.find((row) => row.merchant === "NEW CORNER CAFE")!;
    const [food] = (
      await db().execute<{ id: string }>(
        sql`select id from categories where "userId" = ${a} and name = 'Food' and type = 'expense'`,
      )
    ).rows;
    expect(await recategorize(a, item.id, food.id, true)).toMatchObject({
      ok: true,
      pattern: "NEW CORNER CAFE",
    });
    expect(await approveEntry(a, item.id)).toBe(true);
    expect(await db().$count(merchantRules, eq(merchantRules.userId, a))).toBe(
      1,
    );
    const next = await captureMessages({
      userId: a,
      source: "sms",
      messages: [sms(text.replace("777.00", "120.00"))],
    });
    expect(next).toMatchObject({ inserted: 1, review: 0 });
    const [learned] = await db()
      .select({ categoryId: transactions.categoryId })
      .from(transactions)
      .where(and(live(a), eq(transactions.amountPaise, 12_000)));
    expect(learned.categoryId).toBe(food.id);
    const rejectable = await captureMessages({
      userId: a,
      source: "sms",
      messages: [
        sms(
          text.replace("777.00", "1.00").replace("NEW CORNER CAFE", "MYSTERY"),
        ),
      ],
    });
    const [mystery] = (await reviewQueue(a)).items.filter(
      (row) => row.merchant === "MYSTERY",
    );
    expect(rejectable.review).toBe(1);
    expect(await rejectEntry(a, mystery.id)).toBe(true);
  }, 30_000);

  it("authenticates ingest tokens, adapts payloads and revokes", async () => {
    expect(
      (await ingestSms(request({ text: sbiUpi.text, sender: "AD-SBIUPI" })))
        .status,
    ).toBe(401);
    expect(
      (await ingestSms(request({ text: sbiUpi.text }, "et_" + "x".repeat(43))))
        .status,
    ).toBe(401);
    const token = await createIngestToken(a, "Test forwarder");
    const single = await ingestSms(
      request(
        {
          text: sbiUpi.text,
          sender: "AD-SBIUPI",
          receivedAt: "2026-11-25T10:00:00+05:30",
        },
        token.token,
      ),
    );
    expect(single.status).toBe(200);
    expect(await single.json()).toMatchObject({
      received: 1,
      inserted: 1,
      duplicates: 0,
    });
    const repeat = await ingestSms(
      request({ text: sbiUpi.text, sender: "AD-SBIUPI" }, token.token),
    );
    expect(await repeat.json()).toMatchObject({ inserted: 0, duplicates: 1 });

    const batch = await ingestSms(
      request(
        {
          messages: alerts
            .filter((item) => item.file === "kotak.txt")
            .map((item) => ({ text: item.text, sender: item.sender })),
        },
        token.token,
      ),
    );
    expect(await batch.json()).toMatchObject({ received: 5, inserted: 5 });
    const forwarder = JSON.parse(
      readFileSync(
        "tests/fixtures/forwarders/incoming-sms-to-url.json",
        "utf8",
      ),
    );
    expect(
      await (await ingestSms(request(forwarder, token.token))).json(),
    ).toMatchObject({ received: 1, duplicates: 1 });
    const m487 = JSON.parse(
      readFileSync("tests/fixtures/forwarders/message487.json", "utf8"),
    );
    expect(
      await (await ingestSms(request(m487, token.token))).json(),
    ).toMatchObject({
      status: "accepted",
      event_id: m487.event_id,
      received: 1,
    });
    expect(
      (await ingestSms(request({ messages: [] }, token.token))).status,
    ).toBe(400);

    expect(await revokeIngestToken(b, token.id)).toBe(false);
    expect(await revokeIngestToken(a, token.id)).toBe(true);
    expect(
      (await ingestSms(request({ text: sbiUpi.text }, token.token))).status,
    ).toBe(401);
    const [row] = await db()
      .select({ lastUsedAt: ingestTokens.lastUsedAt })
      .from(ingestTokens)
      .where(eq(ingestTokens.id, token.id));
    expect(row.lastUsedAt).not.toBeNull();
  }, 60_000);

  it("rate limits per key in Postgres", async () => {
    const key = `test:${randomUUID()}`;
    const now = Date.now();
    expect([
      await rateLimit(key, 2, 60_000, now),
      await rateLimit(key, 2, 60_000, now),
      await rateLimit(key, 2, 60_000, now),
    ]).toEqual([true, true, false]);
    expect(await rateLimit(key, 2, 60_000, now + 60_000)).toBe(true);
    await db().execute(sql`delete from rate_limits where key = ${key}`);
  });

  it("imports CAS holdings once and values them", async () => {
    const first = await importDocument({
      userId: a,
      data: pdf("cas/cams.pdf"),
      fileName: "cams.pdf",
      expected: "cas",
    });
    expect(first).toMatchObject({
      kind: "cas",
      holdingsSaved: 2,
      txnsInserted: 4,
      review: 1,
    });
    const second = await importDocument({
      userId: a,
      data: pdf("cas/cams.pdf"),
      expected: "cas",
    });
    expect(second).toMatchObject({ txnsInserted: 0, txnsDuplicate: 4 });
    await importDocument({
      userId: a,
      data: pdf("cas/nsdl.pdf"),
      expected: "cas",
    });
    const portfolio = await getPortfolio(a);
    expect(portfolio.holdings.length).toBe(6);
    expect(
      portfolio.holdings.find((item) => item.isin === "INE000A01010"),
    ).toMatchObject({ kind: "stock", valuePaise: 2_500_000 });
    expect(portfolio.totals.valuePaise).toBeGreaterThan(0);
  }, 30_000);

  it("keeps every captured record private to its owner", async () => {
    expect((await reviewQueue(b)).items).toEqual([]);
    expect(await reviewCount(b)).toBe(0);
    expect(await listIngestTokens(b)).toEqual([]);
    expect(await getImportJobs(b)).toEqual([]);
    expect((await getPortfolio(b)).holdings).toEqual([]);
    const [entry] = await db()
      .select({ id: transactions.id })
      .from(transactions)
      .where(live(a))
      .limit(1);
    expect(await approveEntry(b, entry.id)).toBe(false);
    expect(await rejectEntry(b, entry.id)).toBe(false);
    expect(await recategorize(b, entry.id, randomUUID(), false)).toMatchObject({
      ok: false,
    });
    const [holding] = await db()
      .select({ id: holdings.id })
      .from(holdings)
      .where(eq(holdings.userId, a))
      .limit(1);
    await expect(
      db()
        .insert(investmentTxns)
        .values({
          userId: b,
          holdingId: holding.id,
          date: "2026-01-01",
          type: "buy",
          units: "1",
          navPaise: 1n,
          amountPaise: 1n,
          importHash: "x",
        }),
    ).rejects.toThrow();
  });

  it("stores no raw SMS, email, PDF or CAS text", async () => {
    const sentinels = [
      "Not You?",
      "If not u?",
      "18002586161",
      "7308080808",
      "Warm Regards",
      "Dear Customer",
      "ABCDE1234F",
      "TEST INVESTOR",
      "investor@example.com",
      "Test Street",
      "50100012341234",
      "412345XXXXXX5678",
      "app-password",
    ];
    const tables = [
      transactions,
      importJobs,
      accounts,
      holdings,
      investmentTxns,
      mailConnections,
      merchantRules,
      ingestTokens,
      aiUsage,
    ];
    for (const table of tables) {
      const rows = await db()
        .select()
        .from(table)
        .where(eq((table as typeof transactions).userId, a));
      const dump = JSON.stringify(rows, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      for (const sentinel of sentinels)
        expect(dump, `${sentinel} found`).not.toContain(sentinel);
    }
  });
});
