"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { saveEntry, saveRecurring } from "../../lib/expense/actions";
import { entrySchema } from "../../lib/expense/validation";
import { indiaToday, frequencies, type Frequency } from "../../lib/expense/dates";
import { paiseToRupees, type EntryType } from "../../lib/expense/money";

export type EntryOptions = {
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: "expense" | "income" }[];
};
type Initial = {
  id: string; type: EntryType; amountPaise: number; note: string; date: string;
  accountId: string; categoryId: string | null; toAccountId: string | null; tags: string[];
};
type Fields = z.input<typeof entrySchema>;

export function EntryEditor({ options, initial, recurring, onClose, onPending }: {
  options: EntryOptions; initial?: Initial; recurring?: boolean; onClose: () => void;
  onPending?: (label?: string) => void;
}) {
  const defaultCategory = (type: EntryType) => options.categories.find(item => item.type === type)?.id ?? "";
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { register, watch, setValue, handleSubmit, formState } = useForm<Fields>({
    resolver: zodResolver(entrySchema, undefined, { raw: true }),
    defaultValues: {
      type: initial?.type ?? "expense", amount: initial ? paiseToRupees(initial.amountPaise) : "",
      note: initial?.note ?? "", date: initial?.date ?? indiaToday(), tags: initial?.tags.join(", ") ?? "",
      accountId: initial?.accountId ?? options.accounts[0]?.id ?? "",
      categoryId: initial ? initial.categoryId ?? "" : defaultCategory("expense"),
      toAccountId: initial?.toAccountId ?? "",
    },
  });
  const type = watch("type");
  const categoryId = watch("categoryId");
  const accountId = watch("accountId");
  const router = useRouter();

  async function submit(fields: Fields) {
    setSaving(true);
    setError("");
    const label = fields.note || options.categories.find(item => item.id === fields.categoryId)?.name || "Transfer";
    onPending?.(label);
    try {
      const result = recurring ? await saveRecurring(fields, frequency) : await saveEntry(fields, initial?.id);
      if (!result.ok) {
        setError(result.fields?.map(field => field.message).join(" ") || result.error);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("The transaction could not be saved. Try again.");
    } finally {
      setSaving(false);
      onPending?.();
    }
  }

  function chooseType(next: EntryType) {
    setValue("type", next);
    setValue("categoryId", defaultCategory(next));
    setValue("toAccountId", next === "transfer" ? options.accounts.find(item => item.id !== accountId)?.id ?? "" : "");
  }

  const message = (name: keyof Fields) => formState.errors[name]?.message
    ? <span className="field-error">{formState.errors[name]?.message}</span> : null;

  return <form className="entry-form stack" onSubmit={handleSubmit(submit)}>
    <label className="field amount-field">Amount
      <input autoFocus inputMode="decimal" placeholder="0.00" aria-invalid={Boolean(formState.errors.amount)} {...register("amount")} />
      {message("amount")}
    </label>
    <fieldset className="bare">
      <legend>Transaction type</legend>
      <div className="segments">{(["expense", "income", "transfer"] as const).map(item =>
        <button type="button" key={item} aria-pressed={type === item} onClick={() => chooseType(item)}>{item}</button>
      )}</div>
    </fieldset>
    <input type="hidden" {...register("type")} />
    <div className="fields-grid">
      <label className="field">{type === "transfer" ? "From account" : "Account"}
        <select {...register("accountId")}>{options.accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        {message("accountId")}
      </label>
      <label className="field">Date<input type="date" {...register("date")} />{message("date")}</label>
    </div>
    {type === "transfer" ? <label className="field">To account
      <select {...register("toAccountId")}>
        <option value="">Choose an account</option>
        {options.accounts.filter(item => item.id !== accountId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>{message("toAccountId")}
    </label> : <fieldset className="bare"><legend>Category</legend>
      <div className="chips">{options.categories.filter(item => item.type === type).map(item =>
        <button type="button" key={item.id} aria-pressed={item.id === categoryId} onClick={() => setValue("categoryId", item.id)}>{item.name}</button>
      )}</div>{message("categoryId")}
    </fieldset>}
    <input type="hidden" {...register("categoryId")} />
    <label className="field">Note<input maxLength={300} {...register("note")} />{message("note")}</label>
    <label className="field">Tags <span className="hint">Separate with commas</span><input {...register("tags")} />{message("tags")}</label>
    {recurring && <label className="field">Frequency
      <select value={frequency} onChange={event => setFrequency(event.target.value as Frequency)}>
        {frequencies.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>}
    {error && <p role="alert" className="field-error">{error}</p>}
    <button className="button primary" disabled={saving || !options.accounts.length} type="submit">
      {saving ? "Saving…" : recurring ? "Save recurring entry" : initial ? "Save changes" : "Add transaction"}
    </button>
  </form>;
}

export function EntryDialog({ options, initial, recurring, open, onOpenChange, trigger, onPending }: {
  options: EntryOptions; initial?: Initial; recurring?: boolean; open?: boolean;
  onOpenChange?: (open: boolean) => void; trigger?: ReactNode; onPending?: (label?: string) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return <Dialog.Root open={isOpen} onOpenChange={setOpen}>
    {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
    <Dialog.Portal>
      <Dialog.Overlay className="dialog-overlay" />
      <Dialog.Content className="dialog-panel">
        <div className="row spread"><Dialog.Title>{recurring ? "New recurring entry" : initial ? "Edit transaction" : "Quick add"}</Dialog.Title>
          <Dialog.Close className="button icon" aria-label="Close dialog"><X size={20} /></Dialog.Close>
        </div>
        <Dialog.Description className="sr-only">Enter transaction information.</Dialog.Description>
        <EntryEditor options={options} initial={initial} recurring={recurring} onClose={() => setOpen(false)} onPending={onPending} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export function QuickAdd({ options, onPending, floating = true }: { options: EntryOptions; onPending?: (label?: string) => void; floating?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!floating) return;
    function keydown(event: KeyboardEvent) {
      const target = event.target;
      if (event.key.toLowerCase() !== "n" || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select, [role=dialog]"))) return;
      event.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [floating]);
  return <EntryDialog options={options} open={open} onOpenChange={setOpen} onPending={onPending}
    trigger={<button className={`button primary${floating ? " quick-add" : ""}`} aria-keyshortcuts={floating ? "N" : undefined}>
      <Plus size={20} aria-hidden /> Add transaction {floating && <kbd>N</kbd>}
    </button>} />;
}
