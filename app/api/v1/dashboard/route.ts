import { ok, withUser } from "../../../../lib/api/http";
import { investmentsValue } from "../../../../lib/capture/investments";
import { reviewCount } from "../../../../lib/capture/review";
import { getDashboard, getOptions } from "../../../../lib/db/queries/ledger";
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
  const [report, options, review, investments] = await Promise.all([
    getDashboard(user.id, month),
    getOptions(user.id),
    reviewCount(user.id),
    investmentsValue(user.id),
  ]);
  return ok({
    month,
    currency: options.currency,
    expensePaise: report.expense,
    incomePaise: report.income,
    netPaise: report.net,
    balancePaise: report.balance,
    investmentsPaise: investments,
    netWorthPaise: report.balance + investments,
    reviewCount: review,
    budgets: report.limits,
    spending: report.spending,
    trend: report.trend,
    latest: report.latest,
  });
});
