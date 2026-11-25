import { and, asc, desc, eq, gte, ilike, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "..";
import { accounts, budgets, categories, recurring, transactions, userPreferences } from "../schema";
import { monthBounds, monthsEndingIn } from "../../expense/dates";
import { accountBalances, budgetPercent, type EntryType } from "../../expense/money";

const live = (userId: string) => and(eq(transactions.userId, userId), isNull(transactions.deletedAt));
const totalAmount = sql<number>`coalesce(sum(${transactions.amountPaise}), 0)`.mapWith(Number);

export async function getOptions(userId: string) {
  const [accountList, categoryList, preferences] = await Promise.all([
    db().select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.name)),
    db().select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.name)),
    db().select({ currency: userPreferences.currency }).from(userPreferences).where(eq(userPreferences.userId, userId)),
  ]);
  return { accounts: accountList, categories: categoryList, currency: preferences[0]?.currency ?? "INR" as const };
}

export async function getAccountsWithBalances(userId: string) {
  const [owned, aggregate] = await Promise.all([
    db().select().from(accounts).where(eq(accounts.userId, userId)).orderBy(asc(accounts.name)),
    db().select({
      accountId: transactions.accountId, toAccountId: transactions.toAccountId,
      type: transactions.type, amountPaise: totalAmount,
    }).from(transactions).where(live(userId)).groupBy(
      transactions.accountId, transactions.toAccountId, transactions.type,
    ),
  ]);
  const amounts = accountBalances(owned, aggregate);
  return owned.map(account => ({ ...account, balancePaise: amounts.get(account.id) ?? account.openingBalancePaise }));
}

export type TransactionFilter = {
  search?: string; from?: string; to?: string; category?: string; account?: string;
  type?: EntryType; minPaise?: number; maxPaise?: number;
};

export async function getTransactions(userId: string, filter: TransactionFilter, requestedPage: number, limit = 25) {
  const conditions: (SQL | undefined)[] = [live(userId)];
  if (filter.search) {
    const search = "%" + filter.search.replace(/[\\%_]/g, "\\$&") + "%";
    conditions.push(or(ilike(transactions.note, search), sql`array_to_string(${transactions.tags}, ',') ilike ${search}`));
  }
  if (filter.from) conditions.push(gte(transactions.date, filter.from));
  if (filter.to) conditions.push(lte(transactions.date, filter.to));
  if (filter.category) conditions.push(eq(transactions.categoryId, filter.category));
  if (filter.account) conditions.push(or(eq(transactions.accountId, filter.account), eq(transactions.toAccountId, filter.account)));
  if (filter.type) conditions.push(eq(transactions.type, filter.type));
  if (filter.minPaise !== undefined) conditions.push(gte(transactions.amountPaise, filter.minPaise));
  if (filter.maxPaise !== undefined) conditions.push(lte(transactions.amountPaise, filter.maxPaise));
  const where = and(...conditions);
  const count = await db().$count(transactions, where);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(count / limit)));
  const entries = await db().select().from(transactions).where(where).orderBy(
    desc(transactions.date), desc(transactions.createdAt), desc(transactions.id),
  ).limit(limit).offset((page - 1) * limit);
  return { count, page, entries, pageCount: Math.max(1, Math.ceil(count / limit)) };
}

export function getExportEntries(userId: string) {
  return db().select().from(transactions).where(live(userId)).orderBy(desc(transactions.date), desc(transactions.createdAt));
}

export async function getBudgets(userId: string, month: string) {
  const period = monthBounds(month);
  const [limits, grouped] = await Promise.all([
    db().select({ id: budgets.id, categoryId: budgets.categoryId, limitPaise: budgets.limitPaise, name: categories.name })
      .from(budgets).leftJoin(categories, and(eq(categories.userId, userId), eq(categories.id, budgets.categoryId)))
      .where(and(eq(budgets.userId, userId), eq(budgets.month, month))).orderBy(asc(categories.name)),
    db().select({ id: transactions.categoryId, amount: totalAmount }).from(transactions)
      .where(and(live(userId), eq(transactions.type, "expense"), gte(transactions.date, period.start), lt(transactions.date, period.end)))
      .groupBy(transactions.categoryId),
  ]);
  const spent = new Map(grouped.map(row => [row.id, row.amount]));
  const total = grouped.reduce((sum, row) => sum + row.amount, 0);
  return limits.map(item => {
    const spentPaise = item.categoryId ? spent.get(item.categoryId) ?? 0 : total;
    return { ...item, name: item.name ?? "Overall", spentPaise, percent: budgetPercent(spentPaise, item.limitPaise) };
  });
}

export async function getReport(userId: string, start: string, end: string) {
  const period = and(live(userId), gte(transactions.date, start), lt(transactions.date, end));
  const [grouped, biggest] = await Promise.all([
    db().select({ name: categories.name, categoryId: categories.id, type: transactions.type, amount: totalAmount })
      .from(transactions)
      .leftJoin(categories, and(eq(categories.userId, userId), eq(transactions.categoryId, categories.id)))
      .where(period).groupBy(categories.id, categories.name, transactions.type),
    db().select().from(transactions).where(and(period, eq(transactions.type, "expense")))
      .orderBy(desc(transactions.amountPaise), desc(transactions.date)).limit(5),
  ]);
  const spending = grouped.filter(row => row.type === "expense").sort((a, b) => b.amount - a.amount);
  const expense = spending.reduce((sum, row) => sum + row.amount, 0);
  const income = grouped.filter(row => row.type === "income").reduce((sum, row) => sum + row.amount, 0);
  return { expense, income, net: income - expense, spending, biggest };
}

export async function getDashboard(userId: string, month: string) {
  const months = monthsEndingIn(month, 6);
  const end = monthBounds(month).end;
  const start = monthBounds(month).start;
  const bucket = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
  const [report, balance, limits, latest, history, entries] = await Promise.all([
    getReport(userId, start, end),
    getAccountsWithBalances(userId),
    getBudgets(userId, month),
    getTransactions(userId, {}, 1, 5),
    db().select({ month: bucket, type: transactions.type, amount: totalAmount })
      .from(transactions).where(and(live(userId), gte(transactions.date, `${months[0]}-01`), lt(transactions.date, end)))
      .groupBy(bucket, transactions.type),
    db().$count(transactions, live(userId)),
  ]);
  const trend = months.map(month => ({
    month,
    income: history.find(row => row.month === month && row.type === "income")?.amount ?? 0,
    expense: history.find(row => row.month === month && row.type === "expense")?.amount ?? 0,
  }));
  return {
    ...report, limits, trend, latest: latest.entries, entryCount: entries,
    balance: balance.reduce((sum, row) => sum + row.balancePaise, 0),
  };
}

export function getRecurring(userId: string) {
  return db().select().from(recurring).where(eq(recurring.userId, userId)).orderBy(asc(recurring.nextDate));
}
