import { accounts, categories } from "../db/schema";
import { db } from "../db";

const expense = [
  ["Food", "utensils"],
  ["Groceries", "shopping-basket"],
  ["Transport", "train-front"],
  ["Rent", "house"],
  ["Bills & Utilities", "receipt-text"],
  ["Mobile & Internet", "smartphone"],
  ["Shopping", "shopping-bag"],
  ["Health", "heart-pulse"],
  ["Entertainment", "clapperboard"],
  ["Education", "graduation-cap"],
  ["Travel", "plane"],
  ["EMI/Loan", "landmark"],
  ["Fuel", "fuel"],
  ["Investments", "trending-up"],
  ["Other", "tag"],
] as const;
const income = [
  ["Salary", "briefcase"],
  ["Freelance", "laptop"],
  ["Interest", "percent"],
  ["Refund", "undo-2"],
  ["Other", "tag"],
] as const;

export const defaultCategories = { expense, income };

type Executor = Pick<ReturnType<typeof db>, "insert">;

/** Adds any missing default categories. Safe to run repeatedly. */
export async function seedCategories(
  userId: string,
  executor: Executor = db(),
) {
  await executor
    .insert(categories)
    .values([
      ...expense.map(([name, icon]) => ({
        userId,
        name,
        icon,
        type: "expense" as const,
        isDefault: true,
      })),
      ...income.map(([name, icon]) => ({
        userId,
        name,
        icon,
        type: "income" as const,
        isDefault: true,
      })),
    ])
    .onConflictDoNothing();
}

export async function seedDefaults(userId: string) {
  await db().transaction(async (tx) => {
    await seedCategories(userId, tx);
    await tx
      .insert(accounts)
      .values([
        { userId, name: "Cash", type: "cash" },
        { userId, name: "Bank", type: "bank" },
      ])
      .onConflictDoNothing();
  });
}
