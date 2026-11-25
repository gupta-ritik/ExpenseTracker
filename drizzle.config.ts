import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { migrationDatabaseUrl, verifiedTlsUrl } from "./lib/env";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const onlyGenerate = process.argv.includes("generate");

export default defineConfig({
  dialect: "postgresql",
  schema: ["./lib/db/auth-schema.ts", "./lib/db/schema.ts"],
  out: "./drizzle",
  ...(onlyGenerate ? {} : { dbCredentials: { url: verifiedTlsUrl(migrationDatabaseUrl()) } }),
  strict: true,
});
