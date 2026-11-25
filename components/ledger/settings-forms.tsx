"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { deleteProfile, removeSetting, saveAccount, saveBudget, saveCategory, saveCurrency, toggleRecurring } from "../../lib/expense/actions";
import { currencies, paiseToRupees, type Currency } from "../../lib/expense/money";

type Result = { ok: true } | { ok: false; error: string; fields?: { message: string }[] };

function ActionForm({ children, submit, label, onSuccess, reset }: {
  children: ReactNode; submit: (values: Record<string, FormDataEntryValue>) => Promise<Result>;
  label: string; onSuccess?: () => void; reset?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setStatus("");
    try {
      const result = await submit(Object.fromEntries(new FormData(form)));
      if (!result.ok) { setError(true); setStatus(result.fields?.map(item => item.message).join(" ") || result.error); return; }
      setError(false);
      setStatus("Saved.");
      if (reset) form.reset();
      onSuccess?.();
      router.refresh();
    } catch {
      setError(true);
      setStatus("The change could not be saved. Try again.");
    } finally { setBusy(false); }
  }

  return <form className="stack" onSubmit={save}>
    {children}
    <div className="row wrap-row"><button type="submit" className="button primary" disabled={busy}>{busy ? "Saving…" : label}</button>
      {status && <span className={error ? "field-error" : undefined} role={error ? "alert" : "status"}>{status}</span>}</div>
  </form>;
}

export function ActionButton({ children, action, confirm }: { children: ReactNode; action: () => Promise<Result>; confirm?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function execute() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch { setError("The change could not be saved. Try again."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" className="button" disabled={busy} onClick={execute}>{children}</button>
    {error && <p role="alert" className="field-error">{error}</p>}</div>;
}

export function AccountForm({ value }: { value?: { id: string; name: string; type: string; openingBalancePaise: number } }) {
  return <ActionForm submit={data => saveAccount(data, value?.id)} label={value ? "Save account" : "Add account"} reset={!value}>
    <div className="fields-grid">
      <label className="field">Account name<input name="name" required maxLength={60} defaultValue={value?.name} /></label>
      <label className="field">Account type<select name="type" defaultValue={value?.type ?? "cash"}>
        <option value="cash">Cash</option><option value="bank">Bank</option><option value="upi">UPI</option><option value="card">Card</option>
      </select></label>
      <label className="field">Opening balance<input name="openingBalance" required inputMode="decimal" defaultValue={paiseToRupees(value?.openingBalancePaise ?? 0)} /></label>
    </div>
  </ActionForm>;
}

export function CategoryForm({ value }: { value?: { id: string; name: string; type: string } }) {
  return <ActionForm submit={data => saveCategory(data, value?.id)} label={value ? "Save category" : "Add category"} reset={!value}>
    <div className="fields-grid">
      <label className="field">Category name<input name="name" required maxLength={60} defaultValue={value?.name} /></label>
      {value ? <input type="hidden" name="type" value={value.type} /> : <label className="field">Category type<select name="type">
        <option value="expense">Expense</option><option value="income">Income</option>
      </select></label>}
    </div>
  </ActionForm>;
}

export function BudgetForm({ month, categories }: { month: string; categories: { id: string; name: string }[] }) {
  return <ActionForm submit={saveBudget} label="Save budget">
    <div className="fields-grid">
      <label className="field">Month<input type="month" name="month" required defaultValue={month} /></label>
      <label className="field">Category<select name="categoryId">
        <option value="">Overall spending</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label className="field">Monthly limit<input name="limit" required inputMode="decimal" placeholder="0.00" /></label>
    </div>
  </ActionForm>;
}

export function CurrencyForm({ currency }: { currency: Currency }) {
  return <ActionForm submit={data => saveCurrency(data.currency)} label="Save currency">
    <label className="field">Display currency<select name="currency" defaultValue={currency}>
      {currencies.map(item => <option key={item} value={item}>{item}</option>)}
    </select></label>
    <p className="hint">Changes the currency symbol. Recorded amounts keep their numeric value.</p>
  </ActionForm>;
}

export function DeleteItem({ kind, id }: { kind: "account" | "category" | "budget"; id: string }) {
  return <ActionButton action={() => removeSetting(kind, id)} confirm={`Delete this ${kind}?`}>Delete {kind}</ActionButton>;
}

export function RecurringToggle({ id, active }: { id: string; active: boolean }) {
  return <ActionButton action={() => toggleRecurring(id, !active)}>{active ? "Pause" : "Resume"}</ActionButton>;
}

export function DeleteProfile() {
  const router = useRouter();
  return <ActionForm submit={data => deleteProfile(data.email)} label="Delete my profile" onSuccess={() => { router.replace("/"); }}>
    <label className="field">Email confirmation<input name="email" type="email" required autoComplete="off" /></label>
  </ActionForm>;
}
