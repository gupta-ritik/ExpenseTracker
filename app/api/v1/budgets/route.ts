import { ok, withUser } from "../../../../lib/api/http";
import { getBudgets } from "../../../../lib/db/queries/ledger";
import { indiaToday } from "../../../../lib/expense/dates";
import { monthSchema } from "../../../../lib/expense/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async (user, request) => {
  const requested = new URL(request.url).searchParams.get("month");
  const month =
    requested && monthSchema.safeParse(requested).success
      ? requested
      : indiaToday().slice(0, 7);
  return ok({ month, items: await getBudgets(user.id, month) });
});
