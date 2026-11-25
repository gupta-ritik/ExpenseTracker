CREATE TYPE "public"."account_type" AS ENUM('cash', 'bank', 'upi', 'card');--> statement-breakpoint
CREATE TYPE "public"."category_type" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('INR', 'USD', 'EUR', 'GBP');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('expense', 'income', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."entry_source" AS ENUM('manual', 'csv', 'recurring');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"openingBalancePaise" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "accounts_userId_id_unique" UNIQUE("userId","id"),
	CONSTRAINT "accounts_userId_name_unique" UNIQUE("userId","name")
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"categoryId" uuid,
	"month" text NOT NULL,
	"limitPaise" integer NOT NULL,
	CONSTRAINT "budgets_userId_categoryId_month_unique" UNIQUE NULLS NOT DISTINCT("userId","categoryId","month"),
	CONSTRAINT "budget_positive_limit" CHECK ("budgets"."limitPaise" > 0),
	CONSTRAINT "budget_month_format" CHECK ("budgets"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'tag' NOT NULL,
	"color" text DEFAULT 'ink' NOT NULL,
	"type" "category_type" NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_userId_id_unique" UNIQUE("userId","id"),
	CONSTRAINT "categories_userId_type_name_unique" UNIQUE("userId","type","name")
);
--> statement-breakpoint
CREATE TABLE "recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"type" "entry_type" NOT NULL,
	"amountPaise" integer NOT NULL,
	"categoryId" uuid,
	"accountId" uuid NOT NULL,
	"toAccountId" uuid,
	"note" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"nextDate" date NOT NULL,
	"anchorDate" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "recurring_userId_id_unique" UNIQUE("userId","id"),
	CONSTRAINT "recurring_positive_amount" CHECK ("recurring"."amountPaise" > 0),
	CONSTRAINT "recurring_entry_shape" CHECK ((
      "recurring"."type" = 'transfer' and "recurring"."categoryId" is null
      and "recurring"."toAccountId" is not null and "recurring"."toAccountId" <> "recurring"."accountId"
    ) or (
      "recurring"."type" <> 'transfer' and "recurring"."categoryId" is not null
      and "recurring"."toAccountId" is null
    ))
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"type" "entry_type" NOT NULL,
	"amountPaise" integer NOT NULL,
	"categoryId" uuid,
	"accountId" uuid NOT NULL,
	"toAccountId" uuid,
	"note" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"date" date NOT NULL,
	"source" "entry_source" DEFAULT 'manual' NOT NULL,
	"importHash" text,
	"recurringId" uuid,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"deletedAt" timestamp with time zone,
	CONSTRAINT "transactions_userId_importHash_unique" UNIQUE("userId","importHash"),
	CONSTRAINT "transactions_userId_recurringId_date_unique" UNIQUE("userId","recurringId","date"),
	CONSTRAINT "transaction_positive_amount" CHECK ("transactions"."amountPaise" > 0),
	CONSTRAINT "transaction_entry_shape" CHECK ((
      "transactions"."type" = 'transfer' and "transactions"."categoryId" is null
      and "transactions"."toAccountId" is not null and "transactions"."toAccountId" <> "transactions"."accountId"
    ) or (
      "transactions"."type" <> 'transfer' and "transactions"."categoryId" is not null
      and "transactions"."toAccountId" is null
    ))
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"userId" text PRIMARY KEY NOT NULL,
	"currency" "currency" DEFAULT 'INR' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_categoryId_categories_userId_id_fk" FOREIGN KEY ("userId","categoryId") REFERENCES "public"."categories"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_account_owner" FOREIGN KEY ("userId","accountId") REFERENCES "public"."accounts"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_destination_owner" FOREIGN KEY ("userId","toAccountId") REFERENCES "public"."accounts"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_category_owner" FOREIGN KEY ("userId","categoryId") REFERENCES "public"."categories"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_account_owner" FOREIGN KEY ("userId","accountId") REFERENCES "public"."accounts"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_destination_owner" FOREIGN KEY ("userId","toAccountId") REFERENCES "public"."accounts"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_category_owner" FOREIGN KEY ("userId","categoryId") REFERENCES "public"."categories"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_recurringId_recurring_userId_id_fk" FOREIGN KEY ("userId","recurringId") REFERENCES "public"."recurring"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "recurring_userId_nextDate_index" ON "recurring" USING btree ("userId","nextDate");--> statement-breakpoint
CREATE INDEX "transactions_userId_date_index" ON "transactions" USING btree ("userId","date");--> statement-breakpoint
CREATE INDEX "transactions_userId_categoryId_index" ON "transactions" USING btree ("userId","categoryId");