import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import { auth } from "../lib/auth";
import { db } from "../lib/db";
import { user } from "../lib/db/auth-schema";
import { databasePool } from "../lib/db/connection";
import { seedSample } from "../lib/expense/sample";

async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const email = "demo@expense.local";
  const [existing] = await db().select({ id: user.id }).from(user).where(eq(user.email, email));
  const profile = existing ?? (await auth().api.signUpEmail({
    body: { name: "ExpenseTracker Demo", email, password: "demo1234" },
  })).user;
  const inserted = await seedSample(profile.id);
  console.log(`Demo account ${email} is ready. Inserted ${inserted} transactions.`);
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => databasePool().end().catch(() => {}));
