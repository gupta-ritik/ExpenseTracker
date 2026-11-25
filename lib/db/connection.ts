import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { pooledDatabaseUrl } from "../env";

let pool: Pool | undefined;

export function databasePool() {
  if (!pool) {
    pool = new Pool({
      connectionString: pooledDatabaseUrl(),
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 5_000,
    });
    attachDatabasePool(pool);
  }
  return pool;
}
