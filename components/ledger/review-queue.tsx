"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import {
  approveReview,
  changeReviewCategory,
  rejectReview,
} from "../../lib/capture/actions";
import type { Currency } from "../../lib/expense/money";
import { EntryDialog, type EntryOptions } from "./entry-form";
import { DateText, Money } from "./shared";

export type ReviewItem = {
  id: string;
  type: "expense" | "income" | "transfer";
  amountPaise: number;
  date: string;
  merchant: string;
  note: string;
  confidence: number;
  source: string;
  categoryId: string | null;
  accountId: string;
  toAccountId: string | null;
  tags: string[];
};

/** Review queue with J/K to move, A approve, E edit, X reject. */
export function ReviewQueue({
  items,
  options,
  currency,
}: {
  items: ReviewItem[];
  options: EntryOptions;
  currency: Currency;
}) {
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ReviewItem>();
  const [status, setStatus] = useState("");
  const [rule, setRule] = useState<{
    id: string;
    categoryId: string;
    merchant: string;
  }>();
  const router = useRouter();
  const visible = items.filter((item) => !hidden.has(item.id));
  const current = visible[Math.min(active, visible.length - 1)];

  const act = useCallback(
    async (item: ReviewItem | undefined, kind: "approve" | "reject") => {
      if (!item) return;
      setHidden((previous) => new Set(previous).add(item.id));
      const result =
        kind === "approve"
          ? await approveReview(item.id)
          : await rejectReview(item.id);
      if ("error" in result && result.error) {
        setHidden((previous) => {
          const next = new Set(previous);
          next.delete(item.id);
          return next;
        });
        setStatus(result.error);
        return;
      }
      setStatus(
        kind === "approve"
          ? `Approved ${item.merchant || item.note}.`
          : `Rejected ${item.merchant || item.note}.`,
      );
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey || editing) return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [role=dialog]"))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === "j")
        setActive((index) => Math.min(index + 1, visible.length - 1));
      else if (key === "k") setActive((index) => Math.max(index - 1, 0));
      else if (key === "a") void act(current, "approve");
      else if (key === "x") void act(current, "reject");
      else if (key === "e" && current) setEditing(current);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [act, current, editing, visible.length]);

  async function category(
    item: ReviewItem,
    categoryId: string,
    always: boolean,
  ) {
    const result = await changeReviewCategory(item.id, categoryId, always);
    if ("error" in result && result.error) {
      setStatus(result.error);
      return;
    }
    setStatus(
      always && result.pattern
        ? `Saved. ${result.pattern} will always use this category.`
        : "Category updated.",
    );
    setRule(
      always || !item.merchant
        ? undefined
        : { id: item.id, categoryId, merchant: item.merchant },
    );
    router.refresh();
  }

  if (!visible.length)
    return (
      <section className="panel empty">
        <h2>Nothing to review</h2>
        <p>Captured transactions that need a second look will appear here.</p>
      </section>
    );

  return (
    <div className="stack">
      <p className="mono section-label" aria-live="polite">
        {status || "// J/K MOVE · A APPROVE · E EDIT · X REJECT"}
      </p>
      <ul className="entries" aria-label="Transactions waiting for review">
        {visible.map((item, index) => {
          const selected = item === current;
          const choices = options.categories.filter(
            (option) => option.type === item.type,
          );
          return (
            <li
              key={item.id}
              className="entry-row"
              aria-current={selected ? "true" : undefined}
              onClick={() => setActive(index)}
            >
              <div className="entry-detail">
                <strong>{item.merchant || item.note}</strong>
                <span className="mono">
                  [{item.source.toUpperCase()}] <DateText value={item.date} /> ·{" "}
                  {item.confidence}% sure
                </span>
                {item.type !== "transfer" && (
                  <label className="field">
                    Category
                    <select
                      value={item.categoryId ?? ""}
                      onChange={(event) =>
                        void category(item, event.target.value, false)
                      }
                    >
                      {choices.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {rule?.id === item.id && (
                  <button
                    type="button"
                    className="button ghost"
                    onClick={() => void category(item, rule.categoryId, true)}
                  >
                    Always use this for {rule.merchant}
                  </button>
                )}
              </div>
              <Money
                amount={
                  item.type === "expense" ? -item.amountPaise : item.amountPaise
                }
                currency={currency}
                tone={item.type === "transfer" ? undefined : item.type}
              />
              <div className="entry-actions row">
                <button
                  type="button"
                  className="button"
                  onClick={() => void act(item, "approve")}
                  aria-keyshortcuts={selected ? "A" : undefined}
                >
                  <Check size={16} aria-hidden /> Approve
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setEditing(item)}
                  aria-keyshortcuts={selected ? "E" : undefined}
                >
                  <Pencil size={16} aria-hidden /> Edit
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => void act(item, "reject")}
                  aria-keyshortcuts={selected ? "X" : undefined}
                >
                  <X size={16} aria-hidden /> Reject
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && (
        <EntryDialog
          options={options}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          initial={{ ...editing, note: editing.note }}
          onSaved={() => {
            const item = editing;
            setEditing(undefined);
            void act(item, "approve");
          }}
        />
      )}
    </div>
  );
}
