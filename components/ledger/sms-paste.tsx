"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { previewPastedSms, savePastedSms } from "../../lib/capture/actions";
import { Money } from "./shared";

type Preview = Extract<
  Awaited<ReturnType<typeof previewPastedSms>>,
  { items: unknown }
>;

const statusLabel = {
  parsed: "Parsed",
  ignored: "Ignored",
  unknown: "Not recognised",
  ai: "AI",
} as const;

/** Paste one or many bank SMS, preview the masked parse, then save. */
export function SmsPaste({ onClose }: { onClose?: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run(save: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (save) {
        const result = await savePastedSms(text);
        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }
        setMessage(
          `${result.inserted} saved · ${result.duplicates} duplicate · ${result.review} to review · ${result.ignored} ignored`,
        );
        setText("");
        setPreview(undefined);
        router.refresh();
      } else {
        const result = await previewPastedSms(text);
        if ("error" in result && result.error) setError(result.error);
        else if ("items" in result) setPreview(result);
      }
    } catch {
      setError("The messages could not be processed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const parsed =
    preview?.items.filter((item) => item.status === "parsed").length ?? 0;
  return (
    <div className="stack">
      <label className="field">
        Bank SMS{" "}
        <span className="hint">
          Separate messages with a blank line. Text is masked and never stored.
        </span>
        <textarea
          rows={7}
          value={text}
          disabled={busy}
          maxLength={20000}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(undefined);
          }}
        />
      </label>
      <div className="row wrap-row">
        <button
          type="button"
          className="button"
          disabled={busy || !text.trim()}
          onClick={() => void run(false)}
        >
          Preview
        </button>
        <button
          type="button"
          className="button primary"
          disabled={
            busy ||
            !preview ||
            !preview.items.some((item) => item.status !== "ignored")
          }
          onClick={() => void run(true)}
        >
          {busy ? "Saving…" : parsed ? `Save ${parsed} parsed` : "Save"}
        </button>
        {onClose && message && (
          <button type="button" className="button ghost" onClick={onClose}>
            Done
          </button>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mono">
          {message}
        </p>
      )}
      {preview && (
        <ul className="rule-list" aria-label="Parsed messages">
          {preview.items.map((item) => (
            <li
              key={item.index}
              className={
                item.status === "parsed" ? "row spread" : "row spread duplicate"
              }
            >
              <span>
                <span className="mono section-label">
                  {statusLabel[item.status]}
                </span>{" "}
                {item.row
                  ? `${item.row.merchant || item.row.bankName || "Bank"}${item.row.last4 ? ` ••${item.row.last4}` : ""} · ${item.row.date}`
                  : item.reason}
              </span>
              {item.row && (
                <Money
                  amount={
                    item.row.type === "expense"
                      ? -item.row.amountPaise
                      : item.row.amountPaise
                  }
                  currency="INR"
                  tone={item.row.type}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
