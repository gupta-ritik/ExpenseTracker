"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { confirmImport, previewImport } from "../../lib/expense/import-actions";
import {
  bankPresets,
  prepareCsv,
  type BankPreset,
  type CsvMapping,
} from "../../lib/expense/csv";
import type { Currency } from "../../lib/expense/money";
import { Money } from "./shared";

const presets: Record<BankPreset, string> = {
  sbi: "SBI",
  hdfc: "HDFC Bank",
  icici: "ICICI Bank",
  axis: "Axis Bank",
  kotak: "Kotak Mahindra Bank",
  generic: "Generic CSV",
};
const mappingFields = [
  ["date", "Date"],
  ["description", "Description"],
  ["debit", "Debit amount"],
  ["credit", "Credit amount"],
  ["amount", "Signed amount"],
  ["direction", "Debit or credit indicator"],
] as const;

type Preview = Extract<
  Awaited<ReturnType<typeof previewImport>>,
  { entries: unknown }
>;

export function ImportForm({
  accounts,
  currency,
}: {
  accounts: { id: string; name: string }[];
  currency: Currency;
}) {
  const [preset, setPreset] = useState<BankPreset>("sbi");
  const [csv, setCsv] = useState("");
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>({});
  const [accountId, setAccountId] = useState(
    accounts.find((item) => item.name === "Bank")?.id ?? accounts[0]?.id ?? "",
  );
  const [preview, setPreview] = useState<Preview>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  function resetView(text: string, kind: BankPreset) {
    const prepared = prepareCsv(text, kind);
    setColumns(prepared.columns);
    setMapping(prepared.mapping);
    setPreview(undefined);
    setMessage("");
    setError("");
  }

  async function chooseFile(file: File | undefined) {
    setCsv("");
    resetView("", preset);
    if (!file) return;
    if (file.size > 750_000) {
      setError("Choose a CSV of up to 750 KB.");
      return;
    }
    try {
      const text = await file.text();
      setCsv(text);
      resetView(text, preset);
    } catch {
      setError("This file could not be read.");
    }
  }

  // A file picked before hydration finished has no change event: read it on mount.
  useEffect(() => {
    const early = input.current?.files?.[0];
    if (early) void chooseFile(early);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(commit: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    const input = { csv, preset, mapping };
    try {
      if (commit) {
        const result = await confirmImport(input, accountId);
        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }
        if ("imported" in result) {
          setMessage(
            `${result.imported} new rows imported. ${result.duplicates} duplicates skipped.`,
          );
          const refreshed = await previewImport(input);
          if ("entries" in refreshed && refreshed.entries)
            setPreview(refreshed as Preview);
          router.refresh();
        }
      } else {
        const result = await previewImport(input);
        if ("error" in result && result.error) setError(result.error);
        else if ("entries" in result && result.entries)
          setPreview(result as Preview);
      }
    } catch {
      setError("Could not process this statement. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="fields-grid">
          <label className="field">
            Bank preset
            <select
              value={preset}
              disabled={busy}
              onChange={(event) => {
                const next = event.target.value as BankPreset;
                setPreset(next);
                resetView(csv, next);
              }}
            >
              {bankPresets.map((item) => (
                <option key={item} value={item}>
                  {presets[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Import into account
            <select
              value={accountId}
              disabled={busy}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Choose an account</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Statement CSV
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            disabled={busy}
            ref={input}
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
        </label>
        {columns.length > 0 && (
          <details open={preset === "generic"} className="filters-panel">
            <summary>Map columns</summary>
            <div className="fields-grid">
              {mappingFields.map(([key, label]) => (
                <label key={key} className="field">
                  {label}
                  <select
                    value={mapping[key] ?? ""}
                    disabled={busy}
                    onChange={(event) => {
                      const selected = event.target.value;
                      setMapping((previous) => ({
                        ...previous,
                        [key]: selected === "" ? undefined : Number(selected),
                      }));
                      setPreview(undefined);
                    }}
                  >
                    <option value="">Unmapped</option>
                    {columns.map((item, index) => (
                      <option key={index} value={index}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>
        )}
        <div>
          <button
            className="button primary"
            disabled={busy || !csv}
            onClick={() => void check(false)}
          >
            Preview rows
          </button>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </section>
      {preview && (
        <section className="panel stack">
          <div className="row spread wrap-row">
            <h2>Preview</h2>
            <p className="mono">
              {preview.entries.filter((row) => !row.duplicate).length} new ·{" "}
              {preview.entries.filter((row) => row.duplicate).length} duplicate
              · {preview.errors.length} skipped
            </p>
          </div>
          {preview.entries.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Note</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.entries.slice(0, 70).map((row) => (
                    <tr
                      key={row.line}
                      className={row.duplicate ? "duplicate" : undefined}
                    >
                      <td className="mono">{row.date}</td>
                      <td>{row.note}</td>
                      <td>
                        <Money
                          amount={
                            row.type === "expense"
                              ? -row.amountPaise
                              : row.amountPaise
                          }
                          currency={currency}
                          tone={row.type}
                        />
                      </td>
                      <td>{row.duplicate ? "Duplicate" : "New"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No valid entries. Adjust the mapping and preview again.</p>
          )}
          {preview.entries.length > 70 && (
            <p>
              Showing the first 70 rows. Confirmation imports all eligible rows.
            </p>
          )}
          {preview.errors.length > 0 && (
            <details>
              <summary>Skipped rows</summary>
              <ul>
                {preview.errors.slice(0, 30).map((row) => (
                  <li key={row.line}>
                    Row {row.line}. {row.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div>
            <button
              className="button primary"
              disabled={busy || !accountId || !preview.entries.length}
              onClick={() => void check(true)}
            >
              Confirm import
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
