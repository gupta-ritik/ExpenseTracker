import {
  apiError,
  decodeCursor,
  encodeCursor,
  ok,
  withUser,
} from "../../../../lib/api/http";
import { reviewCount, reviewQueue } from "../../../../lib/capture/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async (user, request) => {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 25));
  const cursor = decodeCursor(params.get("cursor"));
  if (
    params.get("cursor") &&
    (cursor?.length !== 2 || Number.isNaN(Date.parse(String(cursor[0]))))
  )
    return apiError("invalid_request", "The cursor is not valid.");
  const page = await reviewQueue(
    user.id,
    limit,
    cursor
      ? { createdAt: String(cursor[0]), id: String(cursor[1]) }
      : undefined,
  );
  const last = page.items.at(-1);
  return ok({
    count: await reviewCount(user.id),
    items: page.items,
    nextCursor:
      page.more && last
        ? encodeCursor([last.createdAt.toISOString(), last.id])
        : null,
  });
});
