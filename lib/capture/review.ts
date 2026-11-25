import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db";
import { categories, merchantRules, transactions } from "../db/schema";
import { rulePattern } from "./categorize";

// JS dates carry milliseconds; Postgres keeps microseconds. Page at the same precision.
const createdMs = sql`date_trunc('milliseconds', ${transactions.createdAt})`;

const pending = (userId: string) =>
  and(
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    eq(transactions.status, "needs_review"),
  );

export function reviewCount(userId: string) {
  return db().$count(transactions, pending(userId));
}

export async function reviewQueue(
  userId: string,
  limit = 50,
  after?: { createdAt: string; id: string },
) {
  const rows = await db()
    .select({
      id: transactions.id,
      type: transactions.type,
      amountPaise: transactions.amountPaise,
      date: transactions.date,
      merchant: transactions.merchant,
      note: transactions.note,
      refNo: transactions.refNo,
      confidence: transactions.confidence,
      source: transactions.source,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      toAccountId: transactions.toAccountId,
      tags: transactions.tags,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        pending(userId),
        after
          ? or(
              sql`${createdMs} < ${new Date(after.createdAt)}`,
              and(
                sql`${createdMs} = ${new Date(after.createdAt)}`,
                lt(transactions.id, after.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(createdMs), desc(transactions.id))
    .limit(limit + 1);
  return { items: rows.slice(0, limit), more: rows.length > limit };
}

/** Marks one of the user's captured rows as confirmed. */
export async function approveEntry(userId: string, id: string) {
  const [row] = await db()
    .update(transactions)
    .set({ status: "confirmed" })
    .where(and(pending(userId), eq(transactions.id, id)))
    .returning({ id: transactions.id });
  return Boolean(row);
}

/** Rejecting soft-deletes the row, so the undo window and dedupe still see it. */
export async function rejectEntry(userId: string, id: string) {
  const [row] = await db()
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(and(pending(userId), eq(transactions.id, id)))
    .returning({ id: transactions.id });
  return Boolean(row);
}

/**
 * Changes the category of a review item. With `always`, it also saves a
 * merchant rule so future captures from that merchant use the same category.
 */
export async function recategorize(
  userId: string,
  id: string,
  categoryId: string,
  always: boolean,
) {
  return db().transaction(async (tx) => {
    const [entry] = await tx
      .select({ type: transactions.type, merchant: transactions.merchant })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.id, id),
          isNull(transactions.deletedAt),
        ),
      );
    if (!entry || entry.type === "transfer")
      return { ok: false as const, error: "Transaction could not be found." };
    const [category] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          eq(categories.id, categoryId),
          eq(categories.type, entry.type),
        ),
      );
    if (!category)
      return { ok: false as const, error: "Choose one of your categories." };
    await tx
      .update(transactions)
      .set({ categoryId })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, id)));
    const pattern = rulePattern(entry.merchant);
    if (always && pattern) {
      await tx
        .insert(merchantRules)
        .values({ userId, pattern, categoryId })
        .onConflictDoUpdate({
          target: [merchantRules.userId, merchantRules.pattern],
          set: { categoryId },
        });
      // Apply the new rule to other pending rows from the same merchant.
      await tx
        .update(transactions)
        .set({ categoryId })
        .where(
          and(
            pending(userId),
            eq(transactions.type, entry.type),
            sql`upper(${transactions.merchant}) = ${pattern}`,
          ),
        );
    }
    return { ok: true as const, pattern: always ? pattern : undefined };
  });
}

export function merchantRuleList(userId: string) {
  return db()
    .select({
      id: merchantRules.id,
      pattern: merchantRules.pattern,
      categoryId: merchantRules.categoryId,
    })
    .from(merchantRules)
    .where(eq(merchantRules.userId, userId))
    .orderBy(asc(merchantRules.pattern));
}
