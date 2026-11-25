import { and, eq, lte } from "drizzle-orm";
import { db } from "../db";
import { recurring, transactions } from "../db/schema";
import { indiaToday, nextOccurrence } from "./dates";

export async function postDueEntries(userId: string, today = indiaToday()) {
  await db().transaction(async (tx) => {
    const due = await tx.select().from(recurring).where(and(
      eq(recurring.userId, userId), eq(recurring.active, true), lte(recurring.nextDate, today),
    )).orderBy(recurring.id).for("update");
    for (const template of due) {
      let date = template.nextDate;
      const entries: (typeof transactions.$inferInsert)[] = [];
      while (date <= today && entries.length < 365) {
        entries.push({
          userId, date, recurringId: template.id, source: "recurring",
          type: template.type, amountPaise: template.amountPaise, categoryId: template.categoryId,
          accountId: template.accountId, toAccountId: template.toAccountId, note: template.note, tags: template.tags,
        });
        date = nextOccurrence(date, template.frequency, template.anchorDate);
      }
      await tx.insert(transactions).values(entries).onConflictDoNothing({
        target: [transactions.userId, transactions.recurringId, transactions.date],
      });
      await tx.update(recurring).set({ nextDate: date }).where(and(
        eq(recurring.userId, userId), eq(recurring.id, template.id),
      ));
    }
  });
}
