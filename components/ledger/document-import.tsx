"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { importPdf, previewPdf } from "../../lib/capture/actions";
import type { CasPreview, StatementPreview } from "../../lib/capture/documents";
import type { Currency } from "../../lib/expense/money";
import { Money } from "./shared";

type Kind = "statement" | "cas";

/**
 * PDF statement and CAS upload. The file and password travel to a server action,
 * are parsed in memory and dropped. The password is never stored here.
 */
export function DocumentImport({
  kind,
  accounts,
  currency,
  aiEnabled,
}: {
  kind: Kind;
  accounts: { id: string; name: string }[];
  currency: Currency;
  aiEnabled: boolean;
}) {
  const [file, setFile] = useState<File>();
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [accountId, setAccountId] = useState(
    accounts.find((item) => item.name === "Bank")?.id ?? accounts[0]?.id ?? "",
  );
  const [preview, setPreview] = useState<StatementPreview | CasPreview>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function form() {
    const data = new FormData();
    if (file) data.set("file", file);
    data.set("kind", kind);
    if (password) data.set("password", password);
    if (kind === "statement") data.set("accountId", accountId);
    return data;
  }

  async function check(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(undefined);
    try {
      const result = await previewPdf(form());
      if ("error" in result && result.error) {
        setError(result.error);
        if ("status" in result && result.status === "needs_password")
          setNeedsPassword(true);
        return;
      }
      if ("kind" in result) setPreview(result);
    } catch {
      setError("This PDF could not be processed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await importPdf(form());
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("holdingsSaved" in result)
        setMessage(
          `${result.holdingsSaved} holdings updated · ${result.txnsInserted} new transactions · ${result.txnsDuplicate} already imported.`,
        );
      else if ("inserted" in result)
        setMessage(
          `${result.inserted} new rows imported · ${result.duplicates} duplicates skipped · ${result.review} to review.`,
        );
      router.refresh();
    } catch {
      setError("This PDF could not be imported. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <form className="panel stack" onSubmit={check}>
        {!aiEnabled && (
          <p className="mono section-label">AI parsing off: add GROQ_API_KEY</p>
        )}
        <div className="fields-grid">
          <label className="field">
            {kind === "cas"
              ? "CAS PDF (CAMS, KFintech, NSDL or CDSL)"
              : "Statement PDF (SBI, HDFC, ICICI, Axis, Kotak)"}
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0]);
                setPreview(undefined);
                setError("");
                setMessage("");
              }}
            />
          </label>
          <label className="field">
            PDF password{" "}
            <span className="hint">
              {needsPassword
                ? "This file is protected."
                : "Only if the PDF is protected. Used once, never saved."}
            </span>
            <input
              type="password"
              autoComplete="off"
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {kind === "statement" && (
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
          )}
        </div>
        <div>
          <button className="button primary" disabled={busy || !file}>
            {busy && !preview ? "Reading…" : "Preview"}
          </button>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </form>
      {preview?.kind === "statement" && (
        <section className="panel stack">
          <div className="row spread wrap-row">
            <h2>{preview.bank} statement</h2>
            <p className="mono">
              {preview.periodFrom} → {preview.periodTo} · {preview.rows.length}{" "}
              rows{preview.ai ? " · AI parsed, goes to review" : ""}
            </p>
          </div>
          <dl className="metrics">
            {[
              ["Opening", preview.reconciliation.openingPaise],
              ["Credits", preview.reconciliation.creditsPaise],
              ["Debits", preview.reconciliation.debitsPaise],
              ["Closing", preview.reconciliation.closingPaise],
            ].map(([label, value]) => (
              <div className="metric" key={label}>
                <dt className="mono section-label">{label}</dt>
                <dd>
                  <Money amount={value as number} currency={currency} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mono" role="status">
            {"// RECONCILED: OPENING + CREDITS − DEBITS = CLOSING"}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Note</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 70).map((row, index) => (
                  <tr key={index}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 70 && (
            <p>
              Showing the first 70 rows. Confirmation imports every row;
              duplicates are skipped.
            </p>
          )}
          <div>
            <button
              className="button primary"
              disabled={busy || !accountId}
              onClick={() => void commit()}
            >
              Confirm import
            </button>
          </div>
        </section>
      )}
      {preview?.kind === "cas" && (
        <section className="panel stack">
          <div className="row spread wrap-row">
            <h2>{preview.format.toUpperCase()} CAS</h2>
            <p className="mono">
              {preview.periodFrom ?? "…"} → {preview.periodTo ?? "…"} ·{" "}
              {preview.holdings.length} holdings
            </p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Holding</th>
                  <th>Kind</th>
                  <th>Units</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.holdings.map((item) => (
                  <tr key={`${item.isin}-${item.folio ?? ""}`}>
                    <td>
                      {item.name}
                      <br />
                      <span className="mono hint">
                        {item.isin}
                        {item.folio ? ` · ${item.folio}` : ""}
                      </span>
                    </td>
                    <td className="mono">{item.kind.toUpperCase()}</td>
                    <td className="mono">{item.units.toFixed(3)}</td>
                    <td>
                      <Money amount={item.valuePaise} currency={currency} />
                    </td>
                    <td>
                      {item.needsReview
                        ? "Units don’t add up: needs review"
                        : "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Only ISINs, scheme names, folios and numbers are saved. PAN, name,
            address and email are never stored.
          </p>
          <div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void commit()}
            >
              Confirm import
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
