import { EntryDialog } from "../../../components/ledger/entry-form";
import { RecurringToggle } from "../../../components/ledger/settings-forms";
import { DateText, Empty, Money, PageHeading } from "../../../components/ledger/shared";
import { requireUser } from "../../../lib/auth";
import { getOptions, getRecurring } from "../../../lib/db/queries/ledger";

export const metadata = { title: "Recurring entries" };

export default async function Recurring() {
  const { id } = await requireUser();
  const [options, entries] = await Promise.all([getOptions(id), getRecurring(id)]);
  return <div className="stack">
    <PageHeading title="Recurring entries" action={<EntryDialog options={options} recurring trigger={<button className="button primary">Add recurring entry</button>} />} />
    {entries.length ? <section className="panel"><ul className="rule-list">{entries.map(item => <li key={item.id} className="row spread wrap-row">
      <div><strong>{item.note || item.type}</strong><p><span className="mono">{item.frequency}</span> · Next <DateText value={item.nextDate} /></p></div>
      <Money amount={item.amountPaise} currency={options.currency} /><RecurringToggle id={item.id} active={item.active} /></li>)}</ul></section>
      : <Empty title="No recurring entries"><p>Add a regular expense, income or transfer.</p></Empty>}
  </div>;
}
