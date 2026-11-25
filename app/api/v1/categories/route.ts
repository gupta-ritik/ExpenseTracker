import { ok, withUser } from "../../../../lib/api/http";
import { getOptions } from "../../../../lib/db/queries/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async (user) => {
  const { categories } = await getOptions(user.id);
  return ok({
    items: categories.map(({ id, name, icon, color, type, isDefault }) => ({
      id,
      name,
      icon,
      color,
      type,
      isDefault,
    })),
  });
});
