import { apiError, ok } from "../../../../lib/api/http";
import { cronAuthorized, updateNavs } from "../../../../lib/capture/nav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization")))
    return apiError("unauthorized", "Send the cron secret as a Bearer token.");
  try {
    return ok(await updateNavs());
  } catch (error) {
    console.error(
      "NAV update failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError(
      "unavailable",
      "AMFI NAVs could not be fetched. Try again later.",
    );
  }
}
