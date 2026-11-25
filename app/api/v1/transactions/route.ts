import {
  apiError,
  invalid,
  ok,
  readJson,
  withUser,
} from "../../../../lib/api/http";
import { toEntryRaw, transactionPage } from "../../../../lib/api/ledger";
import { entryInput, listQuery } from "../../../../lib/api/schemas";
import { writeEntry } from "../../../../lib/expense/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async (user, request) => {
  const query = listQuery.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return invalid(query.error);
  const page = await transactionPage(user.id, query.data);
  if (!page) return apiError("invalid_request", "The cursor is not valid.");
  return ok(page);
});

export const POST = withUser(async (user, request) => {
  const input = entryInput.safeParse(await readJson(request));
  if (!input.success) return invalid(input.error);
  const result = await writeEntry(user.id, toEntryRaw(input.data));
  if (!result.ok)
    return apiError(
      result.code === "invalid" ? "invalid_request" : "server_error",
      result.error,
    );
  return ok(result.data, 201);
});
