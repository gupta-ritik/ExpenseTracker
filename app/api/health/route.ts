import { databasePool } from "../../../lib/db/connection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = databasePool();
    await pool.query("select 1");
    await pool.query("select count(*) from transactions");
    return Response.json({ db: "ok" });
  } catch {
    console.error("Database health check failed.");
    return Response.json({ db: "error" }, { status: 503 });
  }
}
