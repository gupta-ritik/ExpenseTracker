import {
  apiError,
  invalid,
  ok,
  readJson,
  withUser,
} from "../../../../../lib/api/http";
import { findEntry, fromRow, toEntryRaw } from "../../../../../lib/api/ledger";
import { entryInput, reviewAction } from "../../../../../lib/api/schemas";
import {
  approveEntry,
  recategorize,
  rejectEntry,
} from "../../../../../lib/capture/review";
import { writeEntry } from "../../../../../lib/expense/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** {action: "approve" | "reject" | "edit"}. Edit can change fields and the category, then approves. */
export const POST = withUser(
  async (user, request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id))
      return apiError("not_found", "This item is not waiting for review.");
    const body = reviewAction.safeParse(await readJson(request));
    if (!body.success) return invalid(body.error);
    if (body.data.action === "approve")
      return (await approveEntry(user.id, id))
        ? ok({ id, status: "confirmed" })
        : apiError("not_found", "This item is not waiting for review.");
    if (body.data.action === "reject")
      return (await rejectEntry(user.id, id))
        ? ok({ id, deleted: true })
        : apiError("not_found", "This item is not waiting for review.");
    const row = await findEntry(user.id, id);
    if (!row || row.status !== "needs_review")
      return apiError("not_found", "This item is not waiting for review.");
    if (body.data.entry) {
      const merged = entryInput.safeParse({
        ...fromRow(row),
        ...body.data.entry,
      });
      if (!merged.success) return invalid(merged.error);
      const saved = await writeEntry(user.id, toEntryRaw(merged.data), id);
      if (!saved.ok)
        return apiError(
          saved.code === "invalid" ? "invalid_request" : "server_error",
          saved.error,
        );
    }
    let pattern: string | undefined;
    if (body.data.categoryId) {
      const changed = await recategorize(
        user.id,
        id,
        body.data.categoryId,
        body.data.always,
      );
      if (!changed.ok) return apiError("invalid_request", changed.error);
      pattern = changed.pattern;
    }
    await approveEntry(user.id, id);
    return ok({ id, status: "confirmed", rule: pattern ?? null });
  },
);
