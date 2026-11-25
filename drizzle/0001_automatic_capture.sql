CREATE TYPE "public"."holding_kind" AS ENUM('mf', 'stock', 'bond', 'etf', 'other');--> statement-breakpoint
CREATE TYPE "public"."import_source" AS ENUM('csv', 'pdf', 'cas', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('running', 'done', 'failed', 'needs_password', 'needs_ai_retry');--> statement-breakpoint
CREATE TYPE "public"."ingest_token_kind" AS ENUM('manual', 'device');--> statement-breakpoint
CREATE TYPE "public"."investment_type" AS ENUM('buy', 'sell', 'sip', 'switch_in', 'switch_out', 'dividend', 'bonus', 'split');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('confirmed', 'needs_review');--> statement-breakpoint
ALTER TYPE "public"."account_type" ADD VALUE 'wallet';--> statement-breakpoint
ALTER TYPE "public"."entry_source" ADD VALUE 'email';--> statement-breakpoint
ALTER TYPE "public"."entry_source" ADD VALUE 'sms';--> statement-breakpoint
ALTER TYPE "public"."entry_source" ADD VALUE 'pdf';--> statement-breakpoint
ALTER TYPE "public"."entry_source" ADD VALUE 'cas';--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"ok" boolean NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"kind" "holding_kind" NOT NULL,
	"isin" text NOT NULL,
	"schemeCode" text,
	"name" text NOT NULL,
	"folio" text,
	"units" numeric(20, 4) NOT NULL,
	"costPaise" bigint NOT NULL,
	"priceePaise" bigint,
	"asOf" date NOT NULL,
	"needsReview" boolean DEFAULT false NOT NULL,
	CONSTRAINT "holdings_userId_id_unique" UNIQUE("userId","id"),
	CONSTRAINT "holdings_userId_isin_folio_unique" UNIQUE NULLS NOT DISTINCT("userId","isin","folio")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"source" "import_source" NOT NULL,
	"fileName" text,
	"periodFrom" date,
	"periodTo" date,
	"mailConnectionId" uuid,
	"messageUid" bigint,
	"rowsFound" integer DEFAULT 0 NOT NULL,
	"rowsInserted" integer DEFAULT 0 NOT NULL,
	"rowsDuplicate" integer DEFAULT 0 NOT NULL,
	"rowsReview" integer DEFAULT 0 NOT NULL,
	"status" "import_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"kind" "ingest_token_kind" NOT NULL,
	"deviceInfo" jsonb,
	"tokenHash" text NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingest_tokens_tokenHash_unique" UNIQUE("tokenHash"),
	CONSTRAINT "ingest_token_hash_format" CHECK ("ingest_tokens"."tokenHash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "investment_txns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"holdingId" uuid NOT NULL,
	"date" date NOT NULL,
	"type" "investment_type" NOT NULL,
	"units" numeric(20, 4) NOT NULL,
	"navPaise" bigint NOT NULL,
	"amountPaise" bigint NOT NULL,
	"importHash" text NOT NULL,
	CONSTRAINT "investment_txns_userId_importHash_unique" UNIQUE("userId","importHash")
);
--> statement-breakpoint
CREATE TABLE "mail_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"imapHost" text NOT NULL,
	"imapPort" integer NOT NULL,
	"imapUser" text NOT NULL,
	"passwordEnc" text NOT NULL,
	"senders" text[] NOT NULL,
	"lastUid" bigint DEFAULT 0 NOT NULL,
	"uidValidity" text,
	"lastSyncAt" timestamp with time zone,
	"lastError" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"pdfPasswordsEnc" jsonb,
	CONSTRAINT "mail_connections_userId_id_unique" UNIQUE("userId","id"),
	CONSTRAINT "mail_connections_userId_imapHost_imapUser_unique" UNIQUE("userId","imapHost","imapUser")
);
--> statement-breakpoint
CREATE TABLE "merchant_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"pattern" text NOT NULL,
	"categoryId" uuid NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_rules_userId_pattern_unique" UNIQUE("userId","pattern")
);
--> statement-breakpoint
CREATE TABLE "nav_prices" (
	"schemeCode" text NOT NULL,
	"date" date NOT NULL,
	"navPaise" bigint NOT NULL,
	CONSTRAINT "nav_prices_schemeCode_date_pk" PRIMARY KEY("schemeCode","date")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"windowStart" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_limits_key_windowStart_pk" PRIMARY KEY("key","windowStart")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "bankName" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "last4" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "merchant" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refNo" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "confidence" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status" "review_status" DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_userId_mailConnectionId_mail_connections_userId_id_fk" FOREIGN KEY ("userId","mailConnectionId") REFERENCES "public"."mail_connections"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_tokens" ADD CONSTRAINT "ingest_tokens_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD CONSTRAINT "investment_txns_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD CONSTRAINT "investment_txns_userId_holdingId_holdings_userId_id_fk" FOREIGN KEY ("userId","holdingId") REFERENCES "public"."holdings"("userId","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail_connections" ADD CONSTRAINT "mail_connections_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_userId_categoryId_categories_userId_id_fk" FOREIGN KEY ("userId","categoryId") REFERENCES "public"."categories"("userId","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_userId_createdAt_index" ON "ai_usage" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "holdings_schemeCode_index" ON "holdings" USING btree ("schemeCode");--> statement-breakpoint
CREATE INDEX "import_jobs_userId_createdAt_index" ON "import_jobs" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "ingest_tokens_userId_index" ON "ingest_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "investment_txns_userId_holdingId_date_index" ON "investment_txns" USING btree ("userId","holdingId","date");--> statement-breakpoint
CREATE INDEX "mail_connections_enabled_index" ON "mail_connections" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "rate_limits_windowStart_index" ON "rate_limits" USING btree ("windowStart");--> statement-breakpoint
CREATE INDEX "transactions_userId_status_index" ON "transactions" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "transactions_userId_refNo_index" ON "transactions" USING btree ("userId","refNo");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "account_last4_format" CHECK ("accounts"."last4" ~ '^[0-9]{4}$');--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_confidence_range" CHECK ("transactions"."confidence" between 0 and 100);