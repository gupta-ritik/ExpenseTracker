import { ok, withUser } from "../../../../lib/api/http";
import { getAccountsWithBalances } from "../../../../lib/db/queries/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async (user) => {
  const items = await getAccountsWithBalances(user.id);
  return ok({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      bankName: item.bankName,
      last4: item.last4,
      openingBalancePaise: item.openingBalancePaise,
      balancePaise: item.balancePaise,
    })),
  });
});
