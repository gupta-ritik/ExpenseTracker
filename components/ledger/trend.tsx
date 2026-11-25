"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, type Currency } from "../../lib/expense/money";

export function Trend({ data, currency }: { data: { month: string; income: number; expense: number }[]; currency: Currency }) {
  const labeled = data.map(item => ({ ...item, month: new Intl.DateTimeFormat("en-IN", {
    month: "short", timeZone: "UTC",
  }).format(new Date(`${item.month}-01T00:00:00Z`)) }));
  return <div className="trend" role="img" aria-label={labeled.map(item =>
    `${item.month}: income ${formatMoney(item.income, currency)}, spending ${formatMoney(item.expense, currency)}`
  ).join(". ")}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={labeled} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--rule)" />
        <XAxis dataKey="month" tick={{ fill: "var(--fg)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip formatter={(value) => formatMoney(Number(value), currency)}
          contentStyle={{ background: "var(--bg)", color: "var(--fg)", border: "2px solid var(--fg)" }} />
        <Bar dataKey="expense" name="Spending" fill="var(--expense)" maxBarSize={24} isAnimationActive={false} />
        <Bar dataKey="income" name="Income" fill="var(--income)" maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
