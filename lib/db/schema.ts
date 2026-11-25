import { sql } from "drizzle-orm";
import {
  type AnyPgColumn, boolean, check, date, foreignKey, index, integer, pgEnum, pgTable, text,
  timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { currencies } from "../expense/money";
import { frequencies } from "../expense/dates";

export const entryTypes = ["expense", "income", "transfer"] as const;
export const accountTypes = ["cash", "bank", "upi", "card"] as const;
export const categoryTypes = ["expense", "income"] as const;
export const entryType = pgEnum("entry_type", entryTypes);
export const accountType = pgEnum("account_type", accountTypes);
export const categoryType = pgEnum("category_type", categoryTypes);
export const frequency = pgEnum("recurring_frequency", frequencies);
export const source = pgEnum("entry_source", ["manual", "csv", "recurring"]);
export const currency = pgEnum("currency", currencies);

export const categories = pgTable("categories", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text().notNull(),
  icon: text().notNull().default("tag"),
  color: text().notNull().default("ink"),
  type: categoryType().notNull(),
  isDefault: boolean().notNull().default(false),
}, table => [
  unique().on(table.userId, table.id),
  unique().on(table.userId, table.type, table.name),
]);

export const accounts = pgTable("accounts", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text().notNull(),
  type: accountType().notNull(),
  openingBalancePaise: integer().notNull().default(0),
}, table => [
  unique().on(table.userId, table.id),
  unique().on(table.userId, table.name),
]);

const entryFields = () => ({
  type: entryType().notNull(),
  amountPaise: integer().notNull(),
  categoryId: uuid(),
  accountId: uuid().notNull(),
  toAccountId: uuid(),
  note: text().notNull().default(""),
  tags: text().array().notNull().default(sql`ARRAY[]::text[]`),
});

function entryConstraints(table: {
  userId: AnyPgColumn;
  accountId: AnyPgColumn;
  toAccountId: AnyPgColumn;
  categoryId: AnyPgColumn;
  amountPaise: AnyPgColumn;
  type: AnyPgColumn;
}, prefix: string) {
  return [
    foreignKey({ name: `${prefix}_account_owner`, columns: [table.userId, table.accountId], foreignColumns: [accounts.userId, accounts.id] }),
    foreignKey({ name: `${prefix}_destination_owner`, columns: [table.userId, table.toAccountId], foreignColumns: [accounts.userId, accounts.id] }),
    foreignKey({ name: `${prefix}_category_owner`, columns: [table.userId, table.categoryId], foreignColumns: [categories.userId, categories.id] }),
    check(`${prefix}_positive_amount`, sql`${table.amountPaise} > 0`),
    check(`${prefix}_entry_shape`, sql`(
      ${table.type} = 'transfer' and ${table.categoryId} is null
      and ${table.toAccountId} is not null and ${table.toAccountId} <> ${table.accountId}
    ) or (
      ${table.type} <> 'transfer' and ${table.categoryId} is not null
      and ${table.toAccountId} is null
    )`),
  ];
}

export const recurring = pgTable("recurring", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  ...entryFields(),
  frequency: frequency().notNull(),
  nextDate: date().notNull(),
  anchorDate: date().notNull(),
  active: boolean().notNull().default(true),
}, table => [
  ...entryConstraints(table, "recurring"),
  unique().on(table.userId, table.id),
  index().on(table.userId, table.nextDate),
]);

export const transactions = pgTable("transactions", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  ...entryFields(),
  date: date().notNull(),
  source: source().notNull().default("manual"),
  importHash: text(),
  recurringId: uuid(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp({ withTimezone: true }),
}, table => [
  ...entryConstraints(table, "transaction"),
  foreignKey({ columns: [table.userId, table.recurringId], foreignColumns: [recurring.userId, recurring.id] }),
  index().on(table.userId, table.date),
  index().on(table.userId, table.categoryId),
  unique().on(table.userId, table.importHash),
  unique().on(table.userId, table.recurringId, table.date),
]);

export const budgets = pgTable("budgets", {
  id: uuid().primaryKey().defaultRandom(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  categoryId: uuid(),
  month: text().notNull(),
  limitPaise: integer().notNull(),
}, table => [
  foreignKey({ columns: [table.userId, table.categoryId], foreignColumns: [categories.userId, categories.id] }),
  unique().on(table.userId, table.categoryId, table.month).nullsNotDistinct(),
  check("budget_positive_limit", sql`${table.limitPaise} > 0`),
  check("budget_month_format", sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
]);

export const userPreferences = pgTable("user_preferences", {
  userId: text().primaryKey().references(() => user.id, { onDelete: "cascade" }),
  currency: currency().notNull().default("INR"),
});
