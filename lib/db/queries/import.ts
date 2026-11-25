import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "..";
import { transactions } from "../schema";

export function candidateImports(userId: string, dates: string[], hashes: string[]) {
  return Promise.all([
    db().select({
      date: transactions.date, amountPaise: transactions.amountPaise,
      type: transactions.type, note: transactions.note,
    }).from(transactions).where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt), inArray(transactions.date, dates))),
    db().select({ hash: transactions.importHash }).from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.importHash, hashes))),
  ]);
}
