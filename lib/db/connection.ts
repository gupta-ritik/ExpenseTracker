import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { pooledDatabaseUrl, verifiedTlsUrl } from "../env";

let pool: Pool | undefined;

export function databasePool() {
  if (!pool) {
    pool = new Pool({
      connectionString: verifiedTlsUrl(pooledDatabaseUrl()),
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 5_000,
    });
    if (process.env.VERCEL === "1") attachDatabasePool(pool);
  }
  return pool;
}
