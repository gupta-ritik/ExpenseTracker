import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db";
import { transactions } from "../db/schema";
import { paiseToRupees } from "../expense/money";
import { decodeCursor, encodeCursor } from "./http";
import type { EntryInput } from "./schemas";

/** Converts API input to the form the shared entry schema validates. */
export function toEntryRaw(input: EntryInput) {
  return {
    type: input.type,
    amount: paiseToRupees(input.amountPaise),
    date: input.date,
    note: input.note,
    tags: input.tags.join(", "),
    accountId: input.accountId,
    categoryId: input.categoryId ?? "",
    toAccountId: input.toAccountId ?? "",
  };
}

export function fromRow(row: typeof transactions.$inferSelect): EntryInput {
  return {
    type: row.type,
    amountPaise: row.amountPaise,
    date: row.date,
    note: row.note,
    tags: row.tags,
    accountId: row.accountId,
    categoryId: row.categoryId,
    toAccountId: row.toAccountId,
  };
}

// JS dates carry milliseconds; Postgres keeps microseconds. Compare at the same precision.
const createdMs = sql`date_trunc('milliseconds', ${transactions.createdAt})`;

/** Keyset pagination on (date desc, createdAt desc, id desc). */
export async function transactionPage(
  userId: string,
  query: {
    cursor?: string;
    limit: number;
    search?: string;
    type?: EntryInput["type"];
    from?: string;
    to?: string;
  },
) {
  const conditions: (SQL | undefined)[] = [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
  ];
  if (query.search) {
    const search = "%" + query.search.replace(/[\\%_]/g, "\\$&") + "%";
    conditions.push(
      or(
        ilike(transactions.note, search),
        ilike(transactions.merchant, search),
      ),
    );
  }
  if (query.type) conditions.push(eq(transactions.type, query.type));
  if (query.from) conditions.push(gte(transactions.date, query.from));
  if (query.to) conditions.push(lte(transactions.date, query.to));
  const cursor = decodeCursor(query.cursor ?? null);
  if (query.cursor) {
    const [date, createdAt, id] = (cursor ?? []).map(String);
    if (
      cursor?.length !== 3 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(createdAt)) ||
      !/^[0-9a-f-]{36}$/.test(id)
    )
      return null;
    conditions.push(
      or(
        lt(transactions.date, date),
        and(
          eq(transactions.date, date),
          sql`${createdMs} < ${new Date(createdAt)}`,
        ),
        and(
          eq(transactions.date, date),
          sql`${createdMs} = ${new Date(createdAt)}`,
          lt(transactions.id, id),
        ),
      ),
    );
  }
  const rows = await db()
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(createdMs), desc(transactions.id))
    .limit(query.limit + 1);
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor([last.date, last.createdAt.toISOString(), last.id])
        : null,
  };
}

export async function findEntry(userId: string, id: string) {
  const [row] = await db()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.id, id),
        isNull(transactions.deletedAt),
      ),
    );
  return row;
}
