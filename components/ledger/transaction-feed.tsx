"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { setEntryDeleted } from "../../lib/expense/actions";
import type { transactions } from "../../lib/db/schema";
import type { Currency } from "../../lib/expense/money";
import { DateText, Money } from "./shared";
import { EntryDialog, type EntryOptions } from "./entry-form";

type Entry = typeof transactions.$inferSelect;

export function TransactionFeed({ entries, options, currency, editable = false }: {
  entries: Entry[]; options: EntryOptions; currency: Currency; editable?: boolean;
}) {
  const [edit, setEdit] = useState<Entry>();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<Entry>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const names = new Map(options.accounts.map(account => [account.id, account.name]));
  const category = new Map(options.categories.map(item => [item.id, item.name]));
  const display = entries.filter(entry => !hidden.has(entry.id));
  const setVisibility = (id: string, deleted: boolean) => setHidden(previous => {
    const next = new Set(previous);
    if (deleted) next.add(id);
    else next.delete(id);
    return next;
  });

  async function toggle(entry: Entry, deleted: boolean) {
    setBusy(true);
    setMessage("");
    setVisibility(entry.id, deleted);
    try {
      const result = await setEntryDeleted(entry.id, deleted);
      if (!result.ok) throw Error(result.error);
      setUndo(deleted ? entry : undefined);
      setMessage(deleted ? "Transaction deleted." : "Transaction restored.");
      router.refresh();
    } catch {
      setVisibility(entry.id, !deleted);
      setMessage("Could not update the transaction. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    {message && <div className="status-bar row spread" role="status">
      <span>{message}</span>{undo && <button className="button" disabled={busy} onClick={() => toggle(undo, false)}>Undo</button>}
    </div>}
    {display.length ? <ul className="entries">
      {display.map((item, position) => {
        const name = item.categoryId ? category.get(item.categoryId) : "Transfer";
        return <Fragment key={item.id}>
          {display[position - 1]?.date !== item.date && <li className="date-row mono"><DateText value={item.date} /></li>}
          <li className="entry-row">
            <div><strong>{item.note || name || "Transaction"}</strong>
              <div className="entry-detail"><span>{name}</span><span>{names.get(item.accountId)}{item.toAccountId && ` → ${names.get(item.toAccountId)}`}</span></div>
            </div>
            <Money amount={item.type === "expense" ? -item.amountPaise : item.amountPaise} currency={currency}
              tone={item.type === "transfer" ? undefined : item.type} />
            {editable && <div className="row entry-actions">
              <button className="button icon" aria-label={`Edit ${item.note || name}`} onClick={() => setEdit(item)}><Pencil size={16} /></button>
              <button className="button icon" aria-label={`Delete ${item.note || name}`} disabled={busy} onClick={() => toggle(item, true)}><Trash2 size={16} /></button>
            </div>}
          </li>
        </Fragment>;
      })}
    </ul> : <p className="empty-copy">No transactions match this view.</p>}
    {edit && <EntryDialog key={edit.id} open onOpenChange={state => { if (!state) setEdit(undefined); }} options={options} initial={edit} />}
  </div>;
}
