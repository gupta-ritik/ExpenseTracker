import Link from "next/link";
import { AccountForm, CategoryForm, CurrencyForm, DeleteItem, DeleteProfile } from "../../../components/ledger/settings-forms";
import { PageHeading } from "../../../components/ledger/shared";
import { requireUser } from "../../../lib/auth";
import { getOptions } from "../../../lib/db/queries/ledger";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { id } = await requireUser();
  const options = await getOptions(id);
  return <div className="stack">
    <PageHeading title="Settings" action={<a className="button" href="/api/export" download>Export CSV</a>} />
    <div className="row wrap-row">
      <Link className="button" href="/reports">Reports</Link><Link className="button" href="/import">Import CSV</Link><Link className="button" href="/recurring">Recurring entries</Link>
    </div>
    <section className="panel"><h2>Currency</h2><CurrencyForm currency={options.currency} /></section>
    <div className="split">
      <section className="panel stack"><h2>Manage accounts</h2><AccountForm />
        <ul className="rule-list">{options.accounts.map(item => <li key={item.id}>
          <details className="filters-panel"><summary>{item.name} <span className="mono">{item.type}</span></summary>
            <div className="stack"><AccountForm value={item} /><DeleteItem kind="account" id={item.id} /></div>
          </details></li>)}</ul>
      </section>
      <section className="panel stack"><h2>Manage categories</h2><CategoryForm />
        <ul className="rule-list">{options.categories.map(item => <li key={item.id}>
          <details className="filters-panel"><summary>{item.name} <span className="mono">{item.type}</span></summary>
            <div className="stack"><CategoryForm value={item} /><DeleteItem kind="category" id={item.id} /></div>
          </details></li>)}</ul>
      </section>
    </div>
    <section className="panel stack"><h2>Delete your profile</h2>
      <p>This permanently deletes your sign-in, accounts, budgets and transactions.</p><DeleteProfile />
    </section>
  </div>;
}
