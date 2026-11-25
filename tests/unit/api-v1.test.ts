import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("../../lib/auth", () => ({
  requireUser: async () => ({ id: session.userId }),
  auth: () => ({
    api: {
      getSession: async () =>
        session.userId
          ? {
              user: {
                id: session.userId,
                name: "API test",
                email: "api@expense.local",
              },
            }
          : null,
    },
  }),
}));

import { db } from "../../lib/db";
import { databasePool } from "../../lib/db/connection";
import { user } from "../../lib/db/auth-schema";
import { seedDefaults } from "../../lib/expense/defaults";
import { getOptions } from "../../lib/db/queries/ledger";
import { captureMessages } from "../../lib/capture/messages";
import { loadTestEnvironment } from "../../scripts/test-environment";
import * as dashboard from "../../app/api/v1/dashboard/route";
import * as list from "../../app/api/v1/transactions/route";
import * as one from "../../app/api/v1/transactions/[id]/route";
import * as restore from "../../app/api/v1/transactions/[id]/restore/route";
import * as categories from "../../app/api/v1/categories/route";
import * as accounts from "../../app/api/v1/accounts/route";
import * as budgets from "../../app/api/v1/budgets/route";
import * as review from "../../app/api/v1/review/route";
import * as reviewItem from "../../app/api/v1/review/[id]/route";
import * as devices from "../../app/api/v1/devices/route";
import * as device from "../../app/api/v1/devices/[id]/route";
import * as register from "../../app/api/v1/devices/register/route";
import * as senders from "../../app/api/v1/sms/senders/route";
import { POST as ingest } from "../../app/api/ingest/sms/route";

const a = randomUUID();
const b = randomUUID();
const call = (
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const as = (id: string) => {
  session.userId = id;
};

describe.skipIf(!existsSync(".env.test"))("/api/v1", () => {
  let accountId = "";
  let foodId = "";
  beforeAll(async () => {
    loadTestEnvironment();
    delete process.env.GROQ_API_KEY;
    await db()
      .insert(user)
      .values(
        [a, b].map((id) => ({
          id,
          name: "API test",
          email: `${id}@expense.local`,
        })),
      );
    await seedDefaults(a);
    await seedDefaults(b);
    const options = await getOptions(a);
    accountId = options.accounts.find((item) => item.name === "Bank")!.id;
    foodId = options.categories.find(
      (item) => item.name === "Food" && item.type === "expense",
    )!.id;
  }, 30_000);
  afterAll(async () => {
    await db()
      .delete(user)
      .where(inArray(user.id, [a, b]));
    await databasePool().end();
  });

  it("requires a session and uses one error shape", async () => {
    as("");
    for (const response of [
      await dashboard.GET(call("GET", "/api/v1/dashboard")),
      await list.GET(call("GET", "/api/v1/transactions")),
      await devices.GET(call("GET", "/api/v1/devices")),
    ]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        error: { code: "unauthorized", message: "Sign in to continue." },
      });
    }
  });

  it("creates, pages, patches, deletes and restores transactions", async () => {
    as(a);
    const created: string[] = [];
    for (let day = 1; day <= 5; day++) {
      const response = await list.POST(
        call("POST", "/api/v1/transactions", {
          type: "expense",
          amountPaise: 1000 * day,
          date: `2026-11-0${day}`,
          note: `api ${day}`,
          tags: ["api"],
          accountId,
          categoryId: foodId,
        }),
      );
      expect(response.status).toBe(201);
      created.push((await response.json()).id);
    }
    const invalid = await list.POST(
      call("POST", "/api/v1/transactions", {
        type: "expense",
        amountPaise: -5,
        date: "x",
        accountId,
      }),
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("invalid_request");
    const bad = await list.POST(
      call("POST", "/api/v1/transactions", "{not json", {}),
    );
    expect(bad.status).toBe(400);

    const first = await (
      await list.GET(call("GET", "/api/v1/transactions?limit=2&search=api"))
    ).json();
    expect(first.items.map((item: { note: string }) => item.note)).toEqual([
      "api 5",
      "api 4",
    ]);
    const second = await (
      await list.GET(
        call(
          "GET",
          `/api/v1/transactions?limit=2&search=api&cursor=${first.nextCursor}`,
        ),
      )
    ).json();
    expect(second.items.map((item: { note: string }) => item.note)).toEqual([
      "api 3",
      "api 2",
    ]);
    const third = await (
      await list.GET(
        call(
          "GET",
          `/api/v1/transactions?limit=2&search=api&cursor=${second.nextCursor}`,
        ),
      )
    ).json();
    expect(third).toMatchObject({ nextCursor: null });
    expect(third.items).toHaveLength(1);
    expect(
      (await list.GET(call("GET", "/api/v1/transactions?cursor=garbage")))
        .status,
    ).toBe(400);

    const patched = await one.PATCH(
      call("PATCH", "/", { note: "patched", amountPaise: 4242 }),
      ctx(created[0]),
    );
    expect(await patched.json()).toMatchObject({
      note: "patched",
      amountPaise: 4242,
      categoryId: foodId,
    });
    const removed = await one.DELETE(call("DELETE", "/"), ctx(created[0]));
    expect(await removed.json()).toMatchObject({
      deleted: true,
      undoUntil: expect.any(String),
    });
    expect((await one.GET(call("GET", "/"), ctx(created[0]))).status).toBe(404);
    expect(
      (await restore.POST(call("POST", "/"), ctx(created[0]))).status,
    ).toBe(200);
    expect((await one.GET(call("GET", "/"), ctx(created[0]))).status).toBe(200);

    as(b);
    expect((await one.GET(call("GET", "/"), ctx(created[1]))).status).toBe(404);
    expect(
      (await one.PATCH(call("PATCH", "/", { note: "stolen" }), ctx(created[1])))
        .status,
    ).toBe(404);
    expect(
      (await one.DELETE(call("DELETE", "/"), ctx(created[1]))).status,
    ).toBe(404);
    expect(
      (
        await (
          await list.GET(call("GET", "/api/v1/transactions?search=api"))
        ).json()
      ).items,
    ).toEqual([]);
    const foreign = await list.POST(
      call("POST", "/api/v1/transactions", {
        type: "expense",
        amountPaise: 1,
        date: "2026-11-01",
        accountId,
        categoryId: foodId,
      }),
    );
    expect(foreign.status).toBe(400);
  }, 60_000);

  it("serves dashboard, categories, accounts and budgets for the session user only", async () => {
    as(a);
    const summary = await (
      await dashboard.GET(call("GET", "/api/v1/dashboard?month=2026-11"))
    ).json();
    expect(summary).toMatchObject({
      month: "2026-11",
      currency: "INR",
      reviewCount: 0,
      investmentsPaise: 0,
    });
    expect(summary.expensePaise).toBeGreaterThan(0);
    expect(summary.netWorthPaise).toBe(summary.balancePaise);
    const cats = await (
      await categories.GET(call("GET", "/api/v1/categories"))
    ).json();
    expect(
      cats.items.some((item: { name: string }) => item.name === "Investments"),
    ).toBe(true);
    const accs = await (
      await accounts.GET(call("GET", "/api/v1/accounts"))
    ).json();
    expect(
      accs.items.find((item: { id: string }) => item.id === accountId),
    ).not.toHaveProperty("userId");
    expect(
      (await (await budgets.GET(call("GET", "/api/v1/budgets"))).json()).items,
    ).toEqual([]);
    as(b);
    const other = await (
      await dashboard.GET(call("GET", "/api/v1/dashboard?month=2026-11"))
    ).json();
    expect(other.expensePaise).toBe(0);
    expect(
      (
        await (await accounts.GET(call("GET", "/api/v1/accounts"))).json()
      ).items.some((item: { id: string }) => item.id === accountId),
    ).toBe(false);
  });

  it("works the review queue", async () => {
    await captureMessages({
      userId: a,
      source: "sms",
      messages: [
        {
          text: "Rs.55.00 spent on HDFC Bank Card 5678 At PLACE ONE On 2026-11-20:10:00:00",
          sender: "VM-HDFCBK",
          receivedAt: new Date(),
        },
        {
          text: "Rs.66.00 spent on HDFC Bank Card 5678 At PLACE TWO On 2026-11-20:10:00:00",
          sender: "VM-HDFCBK",
          receivedAt: new Date(),
        },
        {
          text: "Rs.77.00 spent on HDFC Bank Card 5678 At PLACE THREE On 2026-11-20:10:00:00",
          sender: "VM-HDFCBK",
          receivedAt: new Date(),
        },
      ],
    });
    as(b);
    expect(
      (await (await review.GET(call("GET", "/api/v1/review"))).json()).count,
    ).toBe(0);
    as(a);
    const queue = await (
      await review.GET(call("GET", "/api/v1/review?limit=2"))
    ).json();
    expect(queue.count).toBe(3);
    expect(queue.items).toHaveLength(2);
    const rest = await (
      await review.GET(
        call("GET", `/api/v1/review?limit=2&cursor=${queue.nextCursor}`),
      )
    ).json();
    expect(rest.items).toHaveLength(1);
    const [x, y] = queue.items;
    const z = rest.items[0];
    as(b);
    expect(
      (
        await reviewItem.POST(
          call("POST", "/", { action: "approve" }),
          ctx(x.id),
        )
      ).status,
    ).toBe(404);
    as(a);
    expect(
      await (
        await reviewItem.POST(
          call("POST", "/", { action: "approve" }),
          ctx(x.id),
        )
      ).json(),
    ).toMatchObject({ status: "confirmed" });
    expect(
      await (
        await reviewItem.POST(
          call("POST", "/", { action: "reject" }),
          ctx(y.id),
        )
      ).json(),
    ).toMatchObject({ deleted: true });
    const edited = await (
      await reviewItem.POST(
        call("POST", "/", {
          action: "edit",
          categoryId: foodId,
          always: true,
          entry: { note: "Lunch" },
        }),
        ctx(z.id),
      )
    ).json();
    expect(edited).toMatchObject({ status: "confirmed", rule: z.merchant });
    expect(
      (await reviewItem.POST(call("POST", "/", { action: "nope" }), ctx(z.id)))
        .status,
    ).toBe(400);
    expect(
      (await (await review.GET(call("GET", "/api/v1/review"))).json()).count,
    ).toBe(0);
  }, 30_000);

  it("registers, lists and revokes devices, and syncs sender IDs", async () => {
    as(a);
    const created = await register.POST(
      call("POST", "/api/v1/devices/register", {
        name: "Pixel 8",
        model: "Pixel 8",
        osVersion: "Android 15",
        appVersion: "0.1.0",
      }),
    );
    expect(created.status).toBe(201);
    const { id, token } = await created.json();
    expect(token).toMatch(/^et_/);
    const listed = await (
      await devices.GET(call("GET", "/api/v1/devices"))
    ).json();
    expect(listed.items[0]).toMatchObject({
      id,
      kind: "device",
      deviceInfo: {
        model: "Pixel 8",
        osVersion: "Android 15",
        appVersion: "0.1.0",
      },
    });
    expect(JSON.stringify(listed)).not.toContain(token);
    const sent = await ingest(
      call(
        "POST",
        "/api/ingest/sms",
        {
          messages: [
            {
              text: "Rs.12.00 spent on HDFC Bank Card 5678 At SWIGGY On 2026-11-21:10:00:00",
              sender: "VM-HDFCBK",
            },
          ],
        },
        { authorization: `Bearer ${token}` },
      ),
    );
    expect(await sent.json()).toMatchObject({ inserted: 1 });
    as(b);
    expect((await device.DELETE(call("DELETE", "/"), ctx(id))).status).toBe(
      404,
    );
    expect(
      (await (await devices.GET(call("GET", "/api/v1/devices"))).json()).items,
    ).toEqual([]);
    as(a);
    expect((await device.DELETE(call("DELETE", "/"), ctx(id))).status).toBe(
      200,
    );
    expect(
      (
        await ingest(
          call(
            "POST",
            "/api/ingest/sms",
            { text: "x Rs.1", sender: "VM-HDFCBK" },
            { authorization: `Bearer ${token}` },
          ),
        )
      ).status,
    ).toBe(401);
    const ids = await (
      await senders.GET(call("GET", "/api/v1/sms/senders"))
    ).json();
    expect(ids.items).toContain("*-HDFCBK");
  }, 30_000);
});
