import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { migrationDatabaseUrl, verifiedTlsUrl } from "../lib/env";
import { loadTestEnvironment } from "./test-environment";

async function main() {
  loadTestEnvironment();
  const pool = new Pool({ connectionString: verifiedTlsUrl(migrationDatabaseUrl()), connectionTimeoutMillis: 10_000 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
    console.log("Migrations applied to the isolated Neon test branch.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Test migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
