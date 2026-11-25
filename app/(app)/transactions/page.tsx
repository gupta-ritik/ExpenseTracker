import Link from "next/link";
import { z } from "zod";
import { PageHeading } from "../../../components/ledger/shared";
import { TransactionFeed } from "../../../components/ledger/transaction-feed";
import { requireUser } from "../../../lib/auth";
import { getOptions, getTransactions } from "../../../lib/db/queries/ledger";
import { rupeesToPaise } from "../../../lib/expense/money";

export const metadata = { title: "Transactions" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Transactions({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { id } = await requireUser();
  const params = await searchParams;
  const raw = (name: string) => typeof params[name] === "string" ? params[name] as string : "";
  const date = (name: string) => z.iso.date().safeParse(raw(name)).data;
  const uuid = (name: string) => z.uuid().safeParse(raw(name)).data;
  const page = Math.max(1, Math.min(100_000, Number.parseInt(raw("page"), 10) || 1));
  const filters = {
    search: raw("search").slice(0, 120), from: date("from"), to: date("to"),
    category: uuid("category"), account: uuid("account"),
    type: z.enum(["expense", "income", "transfer"]).safeParse(raw("type")).data,
    minPaise: rupeesToPaise(raw("min")) ?? undefined,
    maxPaise: rupeesToPaise(raw("max")) ?? undefined,
  };
  const [result, options] = await Promise.all([getTransactions(id, filters, page), getOptions(id)]);
  const pageUrl = (number: number) => {
    const query = new URLSearchParams();
    for (const key of ["search", "from", "to", "category", "account", "type", "min", "max"]) {
      if (raw(key)) query.set(key, raw(key));
    }
    query.set("page", String(number));
    return `/transactions?${query}`;
  };
  return <div className="stack">
    <PageHeading title="Transactions" action={<Link className="button" href="/import">Import statement</Link>} />
    <details className="panel filters-panel" open={Boolean(Object.values(filters).some(value => value !== undefined && value !== ""))}>
      <summary>Search and filter</summary>
      <form className="filters" action="/transactions">
        <label className="field">Search<input name="search" placeholder="Note or tag" defaultValue={filters.search} /></label>
        <label className="field">Category<select name="category" defaultValue={filters.category ?? ""}>
          <option value="">All categories</option>{options.categories.map(item => <option value={item.id} key={item.id}>{item.name} · {item.type}</option>)}
        </select></label>
        <label className="field">Account<select name="account" defaultValue={filters.account ?? ""}>
          <option value="">All accounts</option>{options.accounts.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>
        <label className="field">Type<select name="type" defaultValue={filters.type ?? ""}><option value="">All types</option>
          <option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option>
        </select></label>
        <label className="field">From date<input name="from" type="date" defaultValue={filters.from} /></label>
        <label className="field">To date<input name="to" type="date" defaultValue={filters.to} /></label>
        <label className="field">Minimum amount<input name="min" inputMode="decimal" defaultValue={raw("min")} /></label>
        <label className="field">Maximum amount<input name="max" inputMode="decimal" defaultValue={raw("max")} /></label>
        <button className="button primary">Apply filters</button><Link className="button ghost" href="/transactions">Clear filters</Link>
      </form>
    </details>
    <section className="panel" aria-label="Transaction list">
      <p className="mono section-label">{result.count} {result.count === 1 ? "entry" : "entries"}</p>
      <TransactionFeed entries={result.entries} options={options} currency={options.currency} editable />
      {result.pageCount > 1 && <nav className="row wrap-row pagination" aria-label="Transactions pages">
        {result.page > 1 && <Link className="button" href={pageUrl(result.page - 1)}>Previous</Link>}
        <span className="mono">Page {result.page} of {result.pageCount}</span>
        {result.page < result.pageCount && <Link className="button" href={pageUrl(result.page + 1)}>Next</Link>}
      </nav>}
    </section>
  </div>;
}
