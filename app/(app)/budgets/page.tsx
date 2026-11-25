import { BudgetForm, DeleteItem } from "../../../components/ledger/settings-forms";
import { BudgetBar, PageHeading } from "../../../components/ledger/shared";
import { requireUser } from "../../../lib/auth";
import { getBudgets, getOptions } from "../../../lib/db/queries/ledger";
import { indiaToday } from "../../../lib/expense/dates";
import { monthSchema } from "../../../lib/expense/validation";

export const metadata = { title: "Budgets" };

export default async function Budgets({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { id } = await requireUser();
  const month = monthSchema.safeParse((await searchParams).month).data ?? indiaToday().slice(0, 7);
  const [items, options] = await Promise.all([getBudgets(id, month), getOptions(id)]);
  return <div className="stack">
    <PageHeading title="Budgets" action={<form className="row" action="/budgets">
      <label className="field"><span className="sr-only">Budget month</span><input name="month" type="month" defaultValue={month} /></label><button className="button">View month</button>
    </form>} />
    <div className="split">
      <section className="panel"><h2>Monthly limits</h2>{items.length ? items.map(item =>
        <div key={item.id} className="stack budget-item"><BudgetBar label={item.name} spent={item.spentPaise} limit={item.limitPaise} percent={item.percent} currency={options.currency} />
          <DeleteItem kind="budget" id={item.id} /></div>) : <p>No limits set for this month.</p>}</section>
      <section className="panel"><h2>Set a limit</h2><BudgetForm month={month} categories={options.categories.filter(item => item.type === "expense")} /></section>
    </div>
  </div>;
}
