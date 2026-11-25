import Link from "next/link";
import { FileUp } from "lucide-react";
import {
  DateText,
  Empty,
  Money,
  PageHeading,
} from "../../../components/ledger/shared";
import { ValueTrend } from "../../../components/ledger/value-trend";
import { requireUser } from "../../../lib/auth";
import {
  getPortfolio,
  getPortfolioHistory,
} from "../../../lib/capture/investments";
import { getOptions } from "../../../lib/db/queries/ledger";

export const metadata = { title: "Investments" };

const kindLabel: Record<string, string> = {
  mf: "Mutual funds",
  stock: "Stocks",
  bond: "Bonds",
  etf: "ETFs",
  other: "Other",
};
function percent(rate: number | null) {
  return rate === null ? "—" : `${(rate * 100).toFixed(1)}%`;
}

export default async function InvestmentsPage() {
  const { id } = await requireUser();
  const [portfolio, history, options] = await Promise.all([
    getPortfolio(id),
    getPortfolioHistory(id),
    getOptions(id),
  ]);
  const currency = options.currency;
  const action = (
    <Link href="/import" className="button">
      <FileUp size={17} aria-hidden /> Import CAS
    </Link>
  );
  if (!portfolio.holdings.length)
    return (
      <div className="stack">
        <PageHeading title="Investments" label="// PORTFOLIO" action={action} />
        <Empty title="No holdings yet">
          <p>
            Import a CAMS, KFintech, NSDL or CDSL statement to track mutual
            funds, stocks, bonds and ETFs.
          </p>
        </Empty>
      </div>
    );
  const { totals } = portfolio;
  return (
    <div className="stack">
      <PageHeading title="Investments" label="// PORTFOLIO" action={action} />
      <section className="metrics" aria-label="Portfolio totals">
        {[
          ["Value", totals.valuePaise],
          ["Invested", totals.costPaise],
          ["Gain", totals.gainPaise],
        ].map(([label, amount]) => (
          <div className="metric" key={label}>
            <span className="mono section-label">{label}</span>
            <Money
              amount={amount as number}
              currency={currency}
              tone={
                label === "Gain"
                  ? totals.gainPaise < 0
                    ? "expense"
                    : "income"
                  : undefined
              }
            />
          </div>
        ))}
        <div className="metric">
          <span className="mono section-label">XIRR</span>
          <span className="money">{percent(totals.xirr)}</span>
        </div>
      </section>
      <div className="split">
        <section className="panel">
          <h2>Allocation</h2>
          <ul className="rule-list">
            {portfolio.byKind
              .sort((a, b) => b.valuePaise - a.valuePaise)
              .map((item) => (
                <li key={item.kind} className="row spread">
                  <span>{kindLabel[item.kind] ?? item.kind}</span>
                  <span>
                    <Money amount={item.valuePaise} currency={currency} />{" "}
                    <span className="mono">
                      {totals.valuePaise
                        ? Math.round(
                            (item.valuePaise * 100) / totals.valuePaise,
                          )
                        : 0}
                      %
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Value over time</h2>
          {history.some((item) => item.value) ? (
            <ValueTrend data={history} currency={currency} />
          ) : (
            <p className="empty-copy">
              Monthly values appear once NAVs are updated.
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Holdings</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Holding</th>
                <th>Units</th>
                <th>Cost</th>
                <th>Value</th>
                <th>P&amp;L</th>
                <th>XIRR</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.holdings.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.name}
                    <br />
                    <span className="mono hint">
                      [{item.kind.toUpperCase()}] {item.isin}
                      {item.folio ? ` · ${item.folio}` : ""}
                      {item.needsReview ? " · needs review" : ""}
                    </span>
                  </td>
                  <td className="mono">{item.units.toFixed(3)}</td>
                  <td>
                    <Money amount={item.costPaise} currency={currency} />
                  </td>
                  <td>
                    <Money amount={item.valuePaise} currency={currency} />
                  </td>
                  <td>
                    <Money
                      amount={item.gainPaise}
                      currency={currency}
                      tone={item.gainPaise < 0 ? "expense" : "income"}
                    />
                  </td>
                  <td className="mono">{percent(item.xirr)}</td>
                  <td className="mono">
                    {item.asOf ? <DateText value={item.asOf} /> : "—"}{" "}
                    <span className="hint">{item.priceSource}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
