import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { currencies } from "../expense/money";
import { frequencies } from "../expense/dates";

export const entryTypes = ["expense", "income", "transfer"] as const;
export const accountTypes = ["cash", "bank", "upi", "card", "wallet"] as const;
export const categoryTypes = ["expense", "income"] as const;
export const entryType = pgEnum("entry_type", entryTypes);
export const accountType = pgEnum("account_type", accountTypes);
export const categoryType = pgEnum("category_type", categoryTypes);
export const frequency = pgEnum("recurring_frequency", frequencies);
export const source = pgEnum("entry_source", [
  "manual",
  "csv",
  "recurring",
  "email",
  "sms",
  "pdf",
  "cas",
]);
export const currency = pgEnum("currency", currencies);
export const reviewStatus = pgEnum("review_status", [
  "confirmed",
  "needs_review",
]);
export const ingestTokenKind = pgEnum("ingest_token_kind", [
  "manual",
  "device",
]);
export const importSource = pgEnum("import_source", [
  "csv",
  "pdf",
  "cas",
  "email",
  "sms",
]);
export const importStatus = pgEnum("import_status", [
  "running",
  "done",
  "failed",
  "needs_password",
  "needs_ai_retry",
]);
export const holdingKind = pgEnum("holding_kind", [
  "mf",
  "stock",
  "bond",
  "etf",
  "other",
]);
export const investmentType = pgEnum("investment_type", [
  "buy",
  "sell",
  "sip",
  "switch_in",
  "switch_out",
  "dividend",
  "bonus",
  "split",
]);

export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    icon: text().notNull().default("tag"),
    color: text().notNull().default("ink"),
    type: categoryType().notNull(),
    isDefault: boolean().notNull().default(false),
  },
  (table) => [
    unique().on(table.userId, table.id),
    unique().on(table.userId, table.type, table.name),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: accountType().notNull(),
    openingBalancePaise: integer().notNull().default(0),
    bankName: text(),
    last4: text(),
  },
  (table) => [
    unique().on(table.userId, table.id),
    unique().on(table.userId, table.name),
    check("account_last4_format", sql`${table.last4} ~ '^[0-9]{4}$'`),
  ],
);

const entryFields = () => ({
  type: entryType().notNull(),
  amountPaise: integer().notNull(),
  categoryId: uuid(),
  accountId: uuid().notNull(),
  toAccountId: uuid(),
  note: text().notNull().default(""),
  tags: text()
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
});

function entryConstraints(
  table: {
    userId: AnyPgColumn;
    accountId: AnyPgColumn;
    toAccountId: AnyPgColumn;
    categoryId: AnyPgColumn;
    amountPaise: AnyPgColumn;
    type: AnyPgColumn;
  },
  prefix: string,
) {
  return [
    foreignKey({
      name: `${prefix}_account_owner`,
      columns: [table.userId, table.accountId],
      foreignColumns: [accounts.userId, accounts.id],
    }),
    foreignKey({
      name: `${prefix}_destination_owner`,
      columns: [table.userId, table.toAccountId],
      foreignColumns: [accounts.userId, accounts.id],
    }),
    foreignKey({
      name: `${prefix}_category_owner`,
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    check(`${prefix}_positive_amount`, sql`${table.amountPaise} > 0`),
    check(
      `${prefix}_entry_shape`,
      sql`(
      ${table.type} = 'transfer' and ${table.categoryId} is null
      and ${table.toAccountId} is not null and ${table.toAccountId} <> ${table.accountId}
    ) or (
      ${table.type} <> 'transfer' and ${table.categoryId} is not null
      and ${table.toAccountId} is null
    )`,
    ),
  ];
}

export const recurring = pgTable(
  "recurring",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...entryFields(),
    frequency: frequency().notNull(),
    nextDate: date().notNull(),
    anchorDate: date().notNull(),
    active: boolean().notNull().default(true),
  },
  (table) => [
    ...entryConstraints(table, "recurring"),
    unique().on(table.userId, table.id),
    index().on(table.userId, table.nextDate),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...entryFields(),
    date: date().notNull(),
    source: source().notNull().default("manual"),
    importHash: text(),
    merchant: text().notNull().default(""),
    refNo: text(),
    confidence: integer().notNull().default(100),
    status: reviewStatus().notNull().default("confirmed"),
    recurringId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    ...entryConstraints(table, "transaction"),
    foreignKey({
      columns: [table.userId, table.recurringId],
      foreignColumns: [recurring.userId, recurring.id],
    }),
    index().on(table.userId, table.date),
    index().on(table.userId, table.categoryId),
    index().on(table.userId, table.status),
    index().on(table.userId, table.refNo),
    check(
      "transaction_confidence_range",
      sql`${table.confidence} between 0 and 100`,
    ),
    unique().on(table.userId, table.importHash),
    unique().on(table.userId, table.recurringId, table.date),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid(),
    month: text().notNull(),
    limitPaise: integer().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
    unique().on(table.userId, table.categoryId, table.month).nullsNotDistinct(),
    check("budget_positive_limit", sql`${table.limitPaise} > 0`),
    check(
      "budget_month_format",
      sql`${table.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  currency: currency().notNull().default("INR"),
  // Bank SMS sender IDs synced to the mobile app. Null means the built-in list.
  smsSenders: text().array(),
});

export const merchantRules = pgTable(
  "merchant_rules",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pattern: text().notNull(),
    categoryId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.userId, table.pattern),
    foreignKey({
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }),
  ],
);

export const ingestTokens = pgTable(
  "ingest_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: ingestTokenKind().notNull(),
    deviceInfo: jsonb().$type<{
      model?: string;
      osVersion?: string;
      appVersion?: string;
    }>(),
    tokenHash: text().notNull().unique(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.userId),
    check(
      "ingest_token_hash_format",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const mailConnections = pgTable(
  "mail_connections",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    imapHost: text().notNull(),
    imapPort: integer().notNull(),
    imapUser: text().notNull(),
    passwordEnc: text().notNull(),
    senders: text().array().notNull(),
    lastUid: bigint({ mode: "number" }).notNull().default(0),
    uidValidity: text(),
    lastSyncAt: timestamp({ withTimezone: true }),
    lastError: text(),
    enabled: boolean().notNull().default(true),
    pdfPasswordsEnc: jsonb().$type<Record<string, string>>(),
  },
  (table) => [
    unique().on(table.userId, table.id),
    unique().on(table.userId, table.imapHost, table.imapUser),
    index().on(table.enabled),
  ],
);

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source: importSource().notNull(),
    fileName: text(),
    periodFrom: date(),
    periodTo: date(),
    mailConnectionId: uuid(),
    messageUid: bigint({ mode: "number" }),
    rowsFound: integer().notNull().default(0),
    rowsInserted: integer().notNull().default(0),
    rowsDuplicate: integer().notNull().default(0),
    rowsReview: integer().notNull().default(0),
    status: importStatus().notNull().default("running"),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.userId, table.createdAt),
    foreignKey({
      columns: [table.userId, table.mailConnectionId],
      foreignColumns: [mailConnections.userId, mailConnections.id],
    }),
  ],
);

export const holdings = pgTable(
  "holdings",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: holdingKind().notNull(),
    isin: text().notNull(),
    schemeCode: text(),
    name: text().notNull(),
    folio: text(),
    units: numeric({ precision: 20, scale: 4 }).notNull(),
    costPaise: bigint({ mode: "bigint" }).notNull(),
    pricePaise: bigint("priceePaise", { mode: "bigint" }),
    asOf: date().notNull(),
    needsReview: boolean().notNull().default(false),
  },
  (table) => [
    unique().on(table.userId, table.id),
    unique().on(table.userId, table.isin, table.folio).nullsNotDistinct(),
    index().on(table.schemeCode),
  ],
);

export const investmentTxns = pgTable(
  "investment_txns",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    holdingId: uuid().notNull(),
    date: date().notNull(),
    type: investmentType().notNull(),
    units: numeric({ precision: 20, scale: 4 }).notNull(),
    navPaise: bigint({ mode: "bigint" }).notNull(),
    amountPaise: bigint({ mode: "bigint" }).notNull(),
    importHash: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.holdingId],
      foreignColumns: [holdings.userId, holdings.id],
    }).onDelete("cascade"),
    unique().on(table.userId, table.importHash),
    index().on(table.userId, table.holdingId, table.date),
  ],
);

export const navPrices = pgTable(
  "nav_prices",
  {
    schemeCode: text().notNull(),
    date: date().notNull(),
    navPaise: bigint({ mode: "bigint" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.schemeCode, table.date] })],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feature: text().notNull(),
    model: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    ok: boolean().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.userId, table.createdAt)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index().on(table.windowStart),
  ],
);
