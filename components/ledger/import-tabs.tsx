"use client";

import { useState, type ReactNode } from "react";

const tabs = [
  ["csv", "CSV"],
  ["statement", "PDF statement"],
  ["cas", "CAS (investments)"],
] as const;
export type ImportTab = (typeof tabs)[number][0];

export function ImportTabs({
  panels,
}: {
  panels: Record<ImportTab, ReactNode>;
}) {
  const [tab, setTab] = useState<ImportTab>("csv");
  return (
    <div className="stack">
      <div className="segments" role="tablist" aria-label="Import type">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{panels[tab]}</div>
    </div>
  );
}
