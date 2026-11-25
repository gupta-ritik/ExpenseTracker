import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts, budgets, categories, transactions } from "../db/schema";
import { indiaToday, monthsEndingIn } from "./dates";
import { seedDefaults } from "./defaults";

export async function seedSample(userId: string) {
  await seedDefaults(userId);
  const months = monthsEndingIn(indiaToday().slice(0, 7), 3);
  return db().transaction(async (tx) => {
    await tx.insert(accounts).values({ userId, name: "UPI", type: "upi" }).onConflictDoNothing();
    const [ownedAccounts, ownedCategories] = await Promise.all([
      tx.select().from(accounts).where(eq(accounts.userId, userId)),
      tx.select().from(categories).where(eq(categories.userId, userId)),
    ]);
    const byAccount = new Map(ownedAccounts.map(item => [item.name, item.id]));
    const byCategory = new Map(ownedCategories.map(item => [`${item.type}/${item.name}`, item.id]));
    const bank = byAccount.get("Bank");
    const cash = byAccount.get("Cash");
    const upi = byAccount.get("UPI");
    if (!bank || !cash || !upi) throw new Error("Sample accounts were not created.");
    const expenses = [
      [2, "Rent", "Apartment rent", 1_650_000, bank],
      [3, "Bills & Utilities", "Electricity bill", 142_500, upi],
      [4, "Groceries", "Weekly vegetable market", 82_000, cash],
      [5, "Transport", "Metro card top-up", 50_000, upi],
      [8, "Food", "Lunch near the office", 34_000, upi],
      [11, "Mobile & Internet", "Home broadband", 82_400, bank],
      [15, "Shopping", "Kitchen supplies", 128_000, upi],
      [19, "Health", "Pharmacy", 62_500, cash],
      [22, "Groceries", "Monthly essentials", 215_000, bank],
      [25, "Entertainment", "Cinema tickets", 68_000, upi],
    ] as const;
    const rows: (typeof transactions.$inferInsert)[] = months.flatMap((month, monthIndex) => {
      const expenseRows = expenses.map(([day, category, note, amountPaise, accountId]) => ({
        userId, type: "expense" as const, accountId, categoryId: byCategory.get(`expense/${category}`),
        date: `${month}-${String(day).padStart(2, "0")}`, note, amountPaise: amountPaise + monthIndex * 100,
        importHash: `sample:${month}:expense:${day}`,
      }));
      return [
        { userId, date: `${month}-01`, note: "Monthly salary", type: "income" as const, amountPaise: 7_250_000, accountId: bank, categoryId: byCategory.get("income/Salary"), importHash: `sample:${month}:salary` },
        { userId, date: `${month}-02`, note: "Cash withdrawal", type: "transfer" as const, amountPaise: 400_000, accountId: bank, toAccountId: cash, importHash: `sample:${month}:cash` },
        { userId, date: `${month}-02`, note: "UPI wallet top-up", type: "transfer" as const, amountPaise: 750_000, accountId: bank, toAccountId: upi, importHash: `sample:${month}:upi` },
        ...expenseRows,
      ];
    });
    const inserted = await tx.insert(transactions).values(rows.filter(row => row.date <= indiaToday()))
      .onConflictDoNothing({ target: [transactions.userId, transactions.importHash] })
      .returning({ id: transactions.id });
    await tx.insert(budgets).values([
      { userId, categoryId: null, month: months[2], limitPaise: 3_500_000 },
      ...ownedCategories.filter(row => row.type === "expense" && ["Groceries", "Food", "Transport"].includes(row.name))
        .map(row => ({ userId, categoryId: row.id, month: months[2], limitPaise: 320_000 })),
    ]).onConflictDoNothing();
    return inserted.length;
  });
}
