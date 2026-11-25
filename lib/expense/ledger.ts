import { and, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { accounts, categories, transactions } from "../db/schema";
import { entrySchema, fieldErrors } from "./validation";

/**
 * Ledger writes shared by the server actions and the /api/v1 routes. Callers
 * pass the authenticated user id; these functions never read a session.
 */
export type LedgerResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fields?: ReturnType<typeof fieldErrors>;
      code?: "invalid" | "not_found" | "conflict";
    };

type Entry = z.output<typeof entrySchema>;

/** Undo window for deleted transactions. */
export const undoWindowMs = 5 * 60_000;

export async function ownedEntry(userId: string, input: Entry) {
  const accountIds = input.toAccountId
    ? [input.accountId, input.toAccountId]
    : [input.accountId];
  const owned = await db().$count(
    accounts,
    and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)),
  );
  if (owned !== accountIds.length) return null;
  if (input.type !== "transfer") {
    const category = await db().$count(
      categories,
      and(
        eq(categories.userId, userId),
        eq(categories.id, input.categoryId),
        eq(categories.type, input.type),
      ),
    );
    if (category !== 1) return null;
  }
  return {
    userId,
    type: input.type,
    amountPaise: input.amount,
    categoryId: input.categoryId || null,
    accountId: input.accountId,
    toAccountId: input.toAccountId || null,
    note: input.note,
    tags: input.tags,
  };
}

export async function writeEntry(
  userId: string,
  raw: unknown,
  entryId?: string,
): Promise<LedgerResult<typeof transactions.$inferSelect>> {
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      code: "invalid",
      error: "Check the highlighted fields.",
      fields: fieldErrors(parsed.error),
    };
  if (entryId && !z.uuid().safeParse(entryId).success)
    return { ok: false, code: "not_found", error: "Invalid transaction." };
  try {
    const draft = await ownedEntry(userId, parsed.data);
    if (!draft)
      return {
        ok: false,
        code: "invalid",
        error: "Choose an account and category that belong to you.",
      };
    const values = { ...draft, date: parsed.data.date };
    const [entry] = entryId
      ? await db()
          .update(transactions)
          .set(values)
          .where(
            and(
              eq(transactions.userId, userId),
              eq(transactions.id, entryId),
              isNull(transactions.deletedAt),
            ),
          )
          .returning()
      : await db().insert(transactions).values(values).returning();
    if (!entry)
      return {
        ok: false,
        code: "not_found",
        error: "Transaction could not be found.",
      };
    return { ok: true, data: entry };
  } catch (error) {
    console.error(
      "Could not save the transaction.",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: "Could not save the transaction." };
  }
}

/** Soft delete, or restore. Restoring through the API is limited to the undo window. */
export async function markDeleted(
  userId: string,
  entryId: string,
  deleted: boolean,
  withinUndoWindow = false,
): Promise<LedgerResult> {
  if (!z.uuid().safeParse(entryId).success || typeof deleted !== "boolean")
    return { ok: false, code: "not_found", error: "Invalid transaction." };
  try {
    const [item] = await db()
      .update(transactions)
      .set({ deletedAt: deleted ? new Date() : null })
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.id, entryId),
          deleted
            ? isNull(transactions.deletedAt)
            : isNotNull(transactions.deletedAt),
          !deleted && withinUndoWindow
            ? gt(transactions.deletedAt, new Date(Date.now() - undoWindowMs))
            : undefined,
        ),
      )
      .returning({ id: transactions.id });
    if (!item)
      return {
        ok: false,
        code: "not_found",
        error: "Transaction could not be found.",
      };
    return { ok: true, data: undefined };
  } catch (error) {
    console.error(
      "Could not update the transaction.",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: "Could not update the transaction." };
  }
}
