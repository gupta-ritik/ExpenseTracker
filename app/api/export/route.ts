import Papa from "papaparse";
import { session } from "../../../lib/auth";
import { getExportEntries, getOptions } from "../../../lib/db/queries/ledger";
import { indiaToday } from "../../../lib/expense/dates";
import { paiseToRupees } from "../../../lib/expense/money";

export const dynamic = "force-dynamic";

export async function GET() {
  const active = await session();
  if (!active) return Response.json({ error: "Sign in to export your ledger." }, { status: 401 });
  const [entries, options] = await Promise.all([getExportEntries(active.user.id), getOptions(active.user.id)]);
  const accounts = new Map(options.accounts.map(item => [item.id, item.name]));
  const categories = new Map(options.categories.map(item => [item.id, item.name]));
  const csv = Papa.unparse({
    fields: ["Date", "Type", "Amount", "Category", "Account", "To Account", "Description", "Tags", "Source"],
    data: entries.map(row => [row.date, row.type, paiseToRupees(row.amountPaise), row.categoryId ? categories.get(row.categoryId) : "",
      accounts.get(row.accountId), row.toAccountId ? accounts.get(row.toAccountId) : "", row.note, row.tags.join("; "), row.source]),
  }, { escapeFormulae: true });
  return new Response(csv, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="expenses-${indiaToday()}.csv"`,
    "Cache-Control": "private, no-store",
  } });
}
