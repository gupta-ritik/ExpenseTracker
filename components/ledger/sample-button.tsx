"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadSampleData } from "../../lib/expense/sample-action";

export function SampleButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setPending(true);
    setError("");
    try {
      await loadSampleData();
      router.refresh();
    } catch {
      setError("Could not load the sample data. Try again.");
    } finally { setPending(false); }
  }
  return <div><button className="button primary" disabled={pending} onClick={load}>{pending ? "Loading…" : "Load sample data"}</button>
    {error && <p role="alert">{error}</p>}</div>;
}
