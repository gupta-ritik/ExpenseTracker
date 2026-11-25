import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  aiUsage,
  categories,
  importJobs,
  merchantRules,
  transactions,
} from "../db/schema";
import { seedCategories } from "../expense/defaults";
import type { CaptureRow } from "./alerts";
import { categorize } from "./categorize";
import {
  captureHash,
  duplicateCandidates,
  isDuplicate,
  type ExistingRow,
} from "./dedupe";
import type { UsageLog } from "./groq";
import { sanitizeMerchant } from "./mask";
import { normalizeMerchant } from "./normalize";

export type IngestRow = CaptureRow & {
  categoryHint?: string;
  instrument?: "card" | "account";
  note?: string;
};
export type IngestSource = "sms" | "email" | "pdf" | "cas" | "csv";
export type JobFields = {
  fileName?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  mailConnectionId?: string | null;
  messageUid?: number | null;
  rowsFound?: number;
};
export type IngestResult = {
  jobId: string;
  inserted: number;
  duplicates: number;
  review: number;
  ids: string[];
};

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

export function usageLogger(userId: string): UsageLog {
  return async (entry) => {
    await db()
      .insert(aiUsage)
      .values({ userId, ...entry });
  };
}

export async function startJob(
  userId: string,
  source: IngestSource,
  fields: JobFields = {},
) {
  const [job] = await db()
    .insert(importJobs)
    .values({ userId, source, ...fields })
    .returning({ id: importJobs.id });
  return job.id;
}

export async function finishJob(
  userId: string,
  jobId: string,
  values: Partial<typeof importJobs.$inferInsert>,
) {
  await db()
    .update(importJobs)
    .set(values)
    .where(and(eq(importJobs.userId, userId), eq(importJobs.id, jobId)));
}

/** Finds or creates the user's account for a masked last4. Model output never reaches here as an id. */
async function resolveAccount(
  tx: Tx,
  userId: string,
  row: IngestRow,
  cache: Map<string, string>,
) {
  const key = `${row.last4 ?? ""}|${row.bankName ?? ""}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const owned = await tx
    .select({
      id: accounts.id,
      name: accounts.name,
      last4: accounts.last4,
      bankName: accounts.bankName,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  let id = row.last4
    ? (
        owned.find(
          (item) =>
            item.last4 === row.last4 &&
            (!row.bankName || !item.bankName || item.bankName === row.bankName),
        ) ?? owned.find((item) => item.last4 === row.last4)
      )?.id
    : (owned.find((item) => item.name === "Bank")?.id ??
      owned.find((item) => item.bankName && item.bankName === row.bankName)
        ?.id);
  if (!id) {
    const name = row.last4
      ? `${row.bankName ?? "Bank"} ••${row.last4}`
      : "Bank";
    await tx
      .insert(accounts)
      .values({
        userId,
        name,
        type: row.instrument === "card" ? "card" : "bank",
        bankName: row.bankName ?? null,
        last4: row.last4 ?? null,
      })
      .onConflictDoNothing();
    [{ id }] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.name, name)));
  }
  cache.set(key, id);
  return id;
}

/**
 * The one ingest path for every captured source: categorize → dedupe → insert in
 * a single database transaction → record the job. Rows must already be masked;
 * merchants are re-sanitized here as a second line of defence.
 */
export async function ingestRows(input: {
  userId: string;
  source: Exclude<IngestSource, "csv">;
  rows: IngestRow[];
  accountId?: string;
  jobId?: string;
  job?: JobFields;
  ignored?: number;
}): Promise<IngestResult> {
  const { userId } = input;
  const jobId =
    input.jobId ?? (await startJob(userId, input.source, input.job));
  try {
    const result = await db().transaction(async (tx) => {
      await seedCategories(userId, tx);
      const [owned, rules] = await Promise.all([
        tx
          .select({
            id: categories.id,
            name: categories.name,
            type: categories.type,
          })
          .from(categories)
          .where(eq(categories.userId, userId)),
        tx
          .select({
            pattern: merchantRules.pattern,
            categoryId: merchantRules.categoryId,
          })
          .from(merchantRules)
          .where(eq(merchantRules.userId, userId)),
      ]);
      const rows = input.rows.map((row) => ({
        ...row,
        merchant: normalizeMerchant(sanitizeMerchant(row.merchant)),
        refNo: row.refNo?.toUpperCase(),
      }));
      const known: ExistingRow[] = await duplicateCandidates(tx, userId, rows);
      const accountCache = new Map<string, string>();
      let inserted = 0,
        duplicates = 0,
        review = 0;
      const ids: string[] = [];
      for (const row of rows) {
        const match = known.find((item) => isDuplicate(row, item));
        if (match) {
          duplicates++;
          const fill: Partial<typeof transactions.$inferInsert> = {};
          if (!match.merchant && row.merchant) fill.merchant = row.merchant;
          if (!match.refNo && row.refNo) fill.refNo = row.refNo;
          if (row.confidence > match.confidence)
            fill.confidence = row.confidence;
          if (Object.keys(fill).length) {
            await tx
              .update(transactions)
              .set(fill)
              .where(
                and(
                  eq(transactions.userId, userId),
                  eq(transactions.id, match.id),
                ),
              );
            Object.assign(match, fill);
          }
          continue;
        }
        const category = categorize(
          {
            merchant: row.merchant,
            note: row.note,
            type: row.type,
            hint: row.categoryHint,
          },
          owned,
          rules,
        );
        if (!category) throw new Error("Missing default categories.");
        const accountId =
          input.accountId ??
          (await resolveAccount(tx, userId, row, accountCache));
        const needsReview =
          row.confidence < 90 ||
          category.matched === "fallback" ||
          category.matched === "hint";
        const [entry] = await tx
          .insert(transactions)
          .values({
            userId,
            accountId,
            type: row.type,
            amountPaise: row.amountPaise,
            categoryId: category.categoryId,
            date: row.date,
            source: input.source,
            merchant: row.merchant,
            refNo: row.refNo ?? null,
            note: (row.note
              ? sanitizeMerchant(row.note)
              : row.merchant || `${row.bankName ?? "Bank"} ${row.type}`
            ).slice(0, 300),
            confidence: row.confidence,
            status: needsReview ? "needs_review" : "confirmed",
            importHash: captureHash(userId, row),
          })
          .onConflictDoNothing({
            target: [transactions.userId, transactions.importHash],
          })
          .returning({ id: transactions.id });
        if (!entry) {
          duplicates++;
          continue;
        }
        inserted++;
        if (needsReview) review++;
        ids.push(entry.id);
        known.push({
          ...row,
          id: entry.id,
          note: row.merchant,
          refNo: row.refNo ?? null,
          last4: row.last4 ?? null,
        });
      }
      const dates = rows.map((row) => row.date).sort();
      await tx
        .update(importJobs)
        .set({
          status: "done",
          periodFrom: input.job?.periodFrom ?? dates[0] ?? null,
          periodTo: input.job?.periodTo ?? dates.at(-1) ?? null,
          rowsFound: input.job?.rowsFound ?? rows.length + (input.ignored ?? 0),
          rowsInserted: inserted,
          rowsDuplicate: duplicates,
          rowsReview: review,
        })
        .where(and(eq(importJobs.userId, userId), eq(importJobs.id, jobId)));
      return { inserted, duplicates, review, ids };
    });
    return { jobId, ...result };
  } catch (error) {
    await finishJob(userId, jobId, {
      status: "failed",
      error: "Captured rows could not be saved.",
    });
    throw error;
  }
}
