import {
  apiError,
  invalid,
  ok,
  readJson,
  withUser,
} from "../../../../../lib/api/http";
import { findEntry, fromRow, toEntryRaw } from "../../../../../lib/api/ledger";
import { entryInput, entryPatch } from "../../../../../lib/api/schemas";
import {
  markDeleted,
  undoWindowMs,
  writeEntry,
} from "../../../../../lib/expense/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f-]{36}$/i;

export const GET = withUser(async (user, _request, { params }: Context) => {
  const { id } = await params;
  const row = uuid.test(id) ? await findEntry(user.id, id) : undefined;
  return row
    ? ok(row)
    : apiError("not_found", "Transaction could not be found.");
});

/** Partial update: unspecified fields keep their stored values. */
export const PATCH = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  const row = uuid.test(id) ? await findEntry(user.id, id) : undefined;
  if (!row) return apiError("not_found", "Transaction could not be found.");
  const patch = entryPatch.safeParse(await readJson(request));
  if (!patch.success) return invalid(patch.error);
  const merged = { ...fromRow(row), ...patch.data };
  if (patch.data.type && patch.data.type !== row.type) {
    if (patch.data.type === "transfer")
      merged.categoryId = patch.data.categoryId ?? null;
    else merged.toAccountId = patch.data.toAccountId ?? null;
  }
  const input = entryInput.safeParse(merged);
  if (!input.success) return invalid(input.error);
  const result = await writeEntry(user.id, toEntryRaw(input.data), id);
  if (!result.ok)
    return apiError(
      result.code === "not_found"
        ? "not_found"
        : result.code === "invalid"
          ? "invalid_request"
          : "server_error",
      result.error,
    );
  return ok(result.data);
});

/** Soft delete. Restore within the undo window with POST …/restore. */
export const DELETE = withUser(async (user, _request, { params }: Context) => {
  const { id } = await params;
  const result = await markDeleted(user.id, id, true);
  if (!result.ok)
    return apiError(
      result.code === "not_found" ? "not_found" : "server_error",
      result.error,
    );
  return ok({
    id,
    deleted: true,
    undoUntil: new Date(Date.now() + undoWindowMs).toISOString(),
  });
});
