import { apiError, ok, withUser } from "../../../../../../lib/api/http";
import { markDeleted } from "../../../../../../lib/expense/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Undo a delete. Only works inside the undo window. */
export const POST = withUser(
  async (user, _request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const result = await markDeleted(user.id, id, false, true);
    if (!result.ok)
      return apiError(
        result.code === "not_found" ? "not_found" : "server_error",
        result.code === "not_found"
          ? "Nothing to undo: the undo window has passed."
          : result.error,
      );
    return ok({ id, deleted: false });
  },
);
