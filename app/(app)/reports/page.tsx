import { differenceInCalendarDays, parseISO } from "date-fns";
import { Money, PageHeading } from "../../../components/ledger/shared";
import { TransactionFeed } from "../../../components/ledger/transaction-feed";
import { requireUser } from "../../../lib/auth";
import { getOptions, getReport } from "../../../lib/db/queries/ledger";
import { indiaToday, monthBounds } from "../../../lib/expense/dates";
import { monthSchema } from "../../../lib/expense/validation";

export const metadata = { title: "Reports" };

export default async function Reports({ searchParams }: { searchParams: Promise<{ month?: string; view?: string }> }) {
  const { id } = await requireUser();
  const today = indiaToday();
  const params = await searchParams;
  const month = monthSchema.safeParse(params.month).data ?? today.slice(0, 7);
  const view = params.view === "year" ? "year" : "month";
  const year = month.slice(0, 4);
  const { start, end } = view === "year" ? { start: `${year}-01-01`, end: `${Number(year) + 1}-01-01` } : monthBounds(month);
  const days = Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)));
  const [report, options] = await Promise.all([getReport(id, start, end), getOptions(id)]);
  const metrics = [
    ["Spending", report.expense], ["Income", report.income], ["Net", report.net],
    ["Average daily spend", Math.round(report.expense / days)],
  ] as const;
  return <div className="stack">
    <PageHeading title="Reports" label={`// ${view === "year" ? year : month}`} />
    <form action="/reports" className="panel row wrap-row">
      <label className="field">View<select name="view" defaultValue={view}><option value="month">Month</option><option value="year">Year</option></select></label>
      <label className="field">Reporting month<input name="month" type="month" defaultValue={month} /></label>
      <button className="button">Show report</button>
    </form>
    <section className="metrics" aria-label="Reporting totals">{metrics.map(([label, amount]) =>
      <div className="metric" key={label}><span className="mono section-label">{label}</span><Money amount={amount} currency={options.currency} /></div>)}</section>
    <div className="split">
      <section className="panel"><h2>Top categories</h2>{report.spending.length ? <ul className="rule-list">{report.spending.map(item =>
        <li key={item.categoryId} className="row spread"><span>{item.name}</span><Money amount={item.amount} currency={options.currency} /></li>)}</ul>
        : <p>No spending in this period.</p>}</section>
      <section className="panel"><h2>Biggest expenses</h2>
        <TransactionFeed entries={report.biggest} options={options} currency={options.currency} /></section>
    </div>
  </div>;
}
