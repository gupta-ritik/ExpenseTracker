import { apiError, ok } from "../../../../lib/api/http";
import { syncAll } from "../../../../lib/capture/email";
import { cronAuthorized } from "../../../../lib/capture/nav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Syncs every enabled mailbox. Stops starting new batches 15 s before the function limit. */
export async function POST(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization")))
    return apiError("unauthorized", "Send the cron secret as a Bearer token.");
  try {
    const summary = await syncAll(Date.now() + (maxDuration - 15) * 1000);
    return ok({
      connections: summary.connections,
      synced: summary.results.map((item) => ({
        messages: item.messages,
        inserted: item.inserted,
        duplicates: item.duplicates,
        review: item.review,
        documents: item.documents,
        done: item.done,
      })),
    });
  } catch (error) {
    console.error(
      "Email sync failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError("server_error", "Email sync failed.");
  }
}
