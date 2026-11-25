import type { ReactNode } from "react";
import { formatMoney, type Currency } from "../../lib/expense/money";
import { format, parseISO } from "date-fns";

export function Money({ amount, currency, tone }: { amount: number; currency: Currency; tone?: "expense" | "income" }) {
  return <span className={`money${tone ? ` text-${tone}` : ""}`}>{formatMoney(amount, currency)}</span>;
}

export function PageHeading({ title, label, action }: { title: string; label?: string; action?: ReactNode }) {
  return <header className="page-heading">
    <div>{label && <p className="mono section-label">{label}</p>}<h1>{title}</h1></div>
    {action}
  </header>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <section className="panel empty"><h2>{title}</h2>{children}</section>;
}

export function DateText({ value }: { value: string }) {
  return <time dateTime={value}>{format(parseISO(value), "d MMM yyyy")}</time>;
}

export function BudgetBar({ label, spent, limit, percent, currency }: {
  label: string; spent: number; limit: number; percent: number; currency: Currency;
}) {
  const status = percent >= 100 ? "over" : percent >= 80 ? "warning" : "on-track";
  return <div className={`budget-bar ${status}`}>
    <div className="row spread"><strong>{label}</strong><span className="mono">{percent}%</span></div>
    <progress value={Math.min(100, percent)} max={100} aria-label={`${label} budget used`} />
    <div className="row spread"><span><Money amount={spent} currency={currency} /> of <Money amount={limit} currency={currency} /></span>
    <span className="mono">{status === "over" ? "Limit reached" : status === "warning" ? "Near limit" : "On track"}</span></div>
  </div>;
}
