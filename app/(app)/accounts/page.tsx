import Link from "next/link";
import { AccountForm } from "../../../components/ledger/settings-forms";
import { Empty, Money, PageHeading } from "../../../components/ledger/shared";
import { requireUser } from "../../../lib/auth";
import { getAccountsWithBalances, getOptions } from "../../../lib/db/queries/ledger";

export const metadata = { title: "Accounts" };

export default async function Accounts() {
  const { id } = await requireUser();
  const [items, options] = await Promise.all([getAccountsWithBalances(id), getOptions(id)]);
  return <div className="stack">
    <PageHeading title="Accounts" action={<Link className="button" href="/settings">Manage accounts</Link>} />
    {items.length ? <section className="metrics" aria-label="Account balances">{items.map(item =>
      <div className="metric" key={item.id}><span className="mono section-label">{item.type}</span><strong>{item.name}</strong>
        <Money amount={item.balancePaise} currency={options.currency} /></div>)}</section>
      : <Empty title="No accounts yet"><p>Add a cash, bank, UPI or card account below.</p></Empty>}
    <section className="panel"><h2>New account</h2><AccountForm /></section>
  </div>;
}
