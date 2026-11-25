import { existsSync } from "node:fs";
import { db } from "../lib/db";
import { databasePool } from "../lib/db/connection";
import { user } from "../lib/db/auth-schema";
import { seedCategories } from "../lib/expense/defaults";
import { loadTestEnvironment } from "./test-environment";

/** Adds categories introduced for automatic capture to every existing user. Idempotent. */
async function main() {
  if (process.argv.includes("--test")) loadTestEnvironment();
  else if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  try {
    const users = await db().select({ id: user.id }).from(user);
    for (const { id } of users) await seedCategories(id);
    console.log(`Default categories checked for ${users.length} users.`);
  } finally {
    await databasePool().end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Category backfill failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
