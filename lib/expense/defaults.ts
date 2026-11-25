import { accounts, categories } from "../db/schema";
import { db } from "../db";

const expense = [
  ["Food", "utensils"], ["Groceries", "shopping-basket"], ["Transport", "train-front"],
  ["Rent", "house"], ["Bills & Utilities", "receipt-text"], ["Mobile & Internet", "smartphone"],
  ["Shopping", "shopping-bag"], ["Health", "heart-pulse"], ["Entertainment", "clapperboard"],
  ["Education", "graduation-cap"], ["Travel", "plane"], ["EMI/Loan", "landmark"], ["Other", "tag"],
] as const;
const income = [["Salary", "briefcase"], ["Freelance", "laptop"], ["Other", "tag"]] as const;

export async function seedDefaults(userId: string) {
  await db().transaction(async (tx) => {
    await tx.insert(categories).values([
      ...expense.map(([name, icon]) => ({ userId, name, icon, type: "expense" as const, isDefault: true })),
      ...income.map(([name, icon]) => ({ userId, name, icon, type: "income" as const, isDefault: true })),
    ]).onConflictDoNothing();
    await tx.insert(accounts).values([
      { userId, name: "Cash", type: "cash" },
      { userId, name: "Bank", type: "bank" },
    ]).onConflictDoNothing();
  });
}
