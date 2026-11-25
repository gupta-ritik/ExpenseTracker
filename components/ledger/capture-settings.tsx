"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import {
  connectEmail,
  createToken,
  disconnectEmail,
  revokeToken,
  savePdfPassword,
  saveSmsSenders,
  syncEmailNow,
} from "../../lib/capture/actions";

type Result = { error?: string } & Record<string, unknown>;

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function run(
    action: () => Promise<Result>,
    success: (result: Result) => string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await action();
      if (result.error) setError(result.error);
      else {
        setMessage(success(result));
        router.refresh();
      }
      return result;
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const feedback = (
    <>
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
    </>
  );
  return { busy, run, feedback };
}

type Connection = {
  id: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  senders: string[];
  lastSyncAt: Date | null;
  lastError: string | null;
  pdfPasswordSenders: string[];
};

export function EmailSettings({
  connections,
  encryption,
}: {
  connections: Connection[];
  encryption: boolean;
}) {
  const { busy, run, feedback } = useAction();
  const [fields, setFields] = useState({
    host: "imap.gmail.com",
    port: "993",
    user: "",
    password: "",
    senders: "",
  });
  const [pdf, setPdf] = useState({ sender: "", password: "" });
  const update =
    (key: keyof typeof fields) => (event: { target: { value: string } }) =>
      setFields((previous) => ({ ...previous, [key]: event.target.value }));
  async function connect(event: FormEvent) {
    event.preventDefault();
    const result = await run(
      () => connectEmail(fields),
      () => "Connected. The mailbox is read only.",
    );
    if (result && !result.error)
      setFields((previous) => ({ ...previous, password: "" }));
  }
  if (!encryption)
    return (
      <p className="mono section-label">
        Email capture off: add ENCRYPTION_KEY
      </p>
    );
  return (
    <div className="stack">
      {connections.map((item) => (
        <div key={item.id} className="stack">
          <div className="row spread wrap-row">
            <span>
              <strong>{item.imapUser}</strong>{" "}
              <span className="mono">
                {item.imapHost}:{item.imapPort}
              </span>
            </span>
            <span className="mono">
              {item.lastSyncAt
                ? `Synced ${formatDistanceToNowStrict(item.lastSyncAt)} ago`
                : "Not synced yet"}
            </span>
          </div>
          {item.lastError && <p className="field-error">{item.lastError}</p>}
          <p className="hint">Bank senders: {item.senders.join(", ")}</p>
          <div className="row wrap-row">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => syncEmailNow(),
                  (result) =>
                    `Synced: ${result.messages} emails · ${result.inserted} new · ${result.duplicates} duplicate · ${result.review} to review`,
                )
              }
            >
              Sync now
            </button>
            <button
              type="button"
              className="button ghost"
              disabled={busy}
              onClick={() =>
                void run(
                  () => disconnectEmail(item.id),
                  () => "Disconnected.",
                )
              }
            >
              Disconnect
            </button>
          </div>
          <details className="filters-panel">
            <summary>
              Saved PDF passwords (optional){" "}
              {item.pdfPasswordSenders.length
                ? `· ${item.pdfPasswordSenders.join(", ")}`
                : ""}
            </summary>
            <form
              className="fields-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => savePdfPassword(item.id, pdf.sender, pdf.password),
                  () => "PDF password saved, encrypted.",
                );
                setPdf({ sender: "", password: "" });
              }}
            >
              <label className="field">
                Sender email or *
                <input
                  value={pdf.sender}
                  onChange={(event) =>
                    setPdf((previous) => ({
                      ...previous,
                      sender: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                PDF password
                <input
                  type="password"
                  autoComplete="off"
                  value={pdf.password}
                  onChange={(event) =>
                    setPdf((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                />
              </label>
              <div>
                <button
                  className="button"
                  disabled={busy || !pdf.sender || !pdf.password}
                >
                  Save password
                </button>
              </div>
            </form>
          </details>
        </div>
      ))}
      <details className="filters-panel" open={!connections.length}>
        <summary>Connect email</summary>
        <form className="stack" onSubmit={connect}>
          <p className="hint">
            Use an app password (Gmail: imap.gmail.com, port 993). Only bank
            alert senders are read, read only. Email bodies are never stored.
          </p>
          <div className="fields-grid">
            <label className="field">
              IMAP host
              <input value={fields.host} onChange={update("host")} />
            </label>
            <label className="field">
              Port
              <input
                inputMode="numeric"
                value={fields.port}
                onChange={update("port")}
              />
            </label>
            <label className="field">
              Email
              <input
                type="email"
                autoComplete="username"
                value={fields.user}
                onChange={update("user")}
              />
            </label>
            <label className="field">
              App password
              <input
                type="password"
                autoComplete="new-password"
                value={fields.password}
                onChange={update("password")}
              />
            </label>
          </div>
          <label className="field">
            Bank sender addresses{" "}
            <span className="hint">
              Optional. Separate with commas; defaults cover the major banks and
              CAS senders.
            </span>
            <textarea
              rows={2}
              value={fields.senders}
              onChange={update("senders")}
            />
          </label>
          <div>
            <button
              className="button primary"
              disabled={busy || !fields.user || !fields.password}
            >
              {busy ? "Testing…" : "Test and connect"}
            </button>
          </div>
        </form>
      </details>
      {feedback}
    </div>
  );
}

type Token = {
  id: string;
  name: string;
  kind: "manual" | "device";
  deviceInfo: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
  } | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export function TokenSettings({
  tokens,
  endpoint,
}: {
  tokens: Token[];
  endpoint: string;
}) {
  const { busy, run, feedback } = useAction();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string>();
  return (
    <div className="stack">
      <p className="hint">
        POST bank SMS to <span className="mono">{endpoint}</span> with{" "}
        <span className="mono">Authorization: Bearer &lt;token&gt;</span>.
      </p>
      <form
        className="row wrap-row"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await run(
            () => createToken(name),
            () => "Token created. Copy it now: it is shown only once.",
          );
          if (result && typeof result.token === "string") {
            setCreated(result.token);
            setName("");
          }
        }}
      >
        <label className="field">
          Token name
          <input
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="iPhone Shortcut"
          />
        </label>
        <button className="button primary" disabled={busy || !name.trim()}>
          Create token
        </button>
      </form>
      {created && (
        <p className="panel mono" role="status" aria-label="New ingest token">
          <strong>{created}</strong>
        </p>
      )}
      {feedback}
      {tokens.length ? (
        <ul className="rule-list">
          {tokens.map((token) => (
            <li key={token.id} className="row spread wrap-row">
              <span>
                <strong>{token.name}</strong>{" "}
                <span className="mono">[{token.kind.toUpperCase()}]</span>
                {token.deviceInfo && (
                  <span className="hint">
                    {" "}
                    {[
                      token.deviceInfo.model,
                      token.deviceInfo.osVersion,
                      token.deviceInfo.appVersion &&
                        `v${token.deviceInfo.appVersion}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                <br />
                <span className="mono hint">
                  {token.revokedAt
                    ? "Revoked"
                    : token.lastUsedAt
                      ? `Used ${formatDistanceToNowStrict(token.lastUsedAt)} ago`
                      : "Never used"}
                </span>
              </span>
              {!token.revokedAt && (
                <button
                  type="button"
                  className="button ghost"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => revokeToken(token.id),
                      () => `${token.name} revoked.`,
                    )
                  }
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">No tokens or devices yet.</p>
      )}
    </div>
  );
}

export function SenderSettings({ senders }: { senders: string[] }) {
  const { busy, run, feedback } = useAction();
  const [text, setText] = useState(senders.join(", "));
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        void run(
          () => saveSmsSenders(text),
          (result) =>
            `${result.count} sender IDs saved. The mobile app syncs them.`,
        );
      }}
    >
      <label className="field">
        Bank SMS sender IDs{" "}
        <span className="hint">
          *-HDFCBK matches any operator prefix, such as VM-HDFCBK.
        </span>
        <textarea
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <div>
        <button className="button" disabled={busy}>
          Save senders
        </button>
      </div>
      {feedback}
    </form>
  );
}
