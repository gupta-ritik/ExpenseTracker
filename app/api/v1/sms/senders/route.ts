import { ok, withUser } from "../../../../../lib/api/http";
import { getSmsSenders } from "../../../../../lib/capture/senders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bank sender IDs for the mobile app's on-device filter. Configurable in Settings. */
export const GET = withUser(async (user) =>
  ok({ items: await getSmsSenders(user.id) }),
);
