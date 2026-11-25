import { ok, withUser } from "../../../../lib/api/http";
import { listIngestTokens } from "../../../../lib/capture/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ingest tokens and devices. Token values are never returned after creation. */
export const GET = withUser(async (user) =>
  ok({ items: await listIngestTokens(user.id) }),
);
