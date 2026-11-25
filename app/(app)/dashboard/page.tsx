import Link from "next/link";
import { ArrowRight, FileUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { requireUser } from "../../../lib/auth";
import { getDashboard, getOptions } from "../../../lib/db/queries/ledger";
import { indiaToday } from "../../../lib/expense/dates";
import { postDueEntries } from "../../../lib/expense/recurring";
import {
  BudgetBar,
  Empty,
  Money,
  PageHeading,
} from "../../../components/ledger/shared";
import { SampleButton } from "../../../components/ledger/sample-button";
import { TransactionFeed } from "../../../components/ledger/transaction-feed";
import { Trend } from "../../../components/ledger/trend";
import { investmentsValue } from "../../../lib/capture/investments";
import { reviewCount } from "../../../lib/capture/review";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  const today = indiaToday();
  const month = today.slice(0, 7);
  await postDueEntries(user.id, today);
  const [report, options, review, invested] = await Promise.all([
    getDashboard(user.id, month),
    getOptions(user.id),
    reviewCount(user.id),
    investmentsValue(user.id),
  ]);
  const metrics = [
    { label: "Net worth", amount: report.balance + invested },
    { label: "Total balance", amount: report.balance },
    { label: "Spending", amount: report.expense, tone: "expense" as const },
    { label: "Income", amount: report.income, tone: "income" as const },
    { label: "Net", amount: report.net },
  ];
  return (
    <div className="stack">
      <PageHeading
        title="Dashboard"
        label={`// THIS MONTH · ${format(parseISO(today), "MMMM yyyy")}`}
        action={
          <div className="row wrap-row">
            {review > 0 && (
              <Link
                href="/review"
                className="button primary"
                aria-label={`${review} transactions to review`}
              >
                REVIEW ({review})
              </Link>
            )}
            <Link href="/import" className="button">
              <FileUp size={17} aria-hidden /> Import
            </Link>
          </div>
        }
      />
      <section className="metrics" aria-label="This month’s totals">
        {metrics.map((item) => (
          <div className="metric" key={item.label}>
            <span className="mono section-label">{item.label}</span>
            <Money
              amount={item.amount}
              tone={item.tone}
              currency={options.currency}
            />
          </div>
        ))}
      </section>
      {!report.entryCount && (
        <Empty title="Start your ledger">
          <p>
            Add a transaction, import a bank statement, or explore the app with
            sample data.
          </p>
          <div className="row wrap-row">
            <SampleButton />
            <Link className="button" href="/import">
              Import bank CSV
            </Link>
          </div>
        </Empty>
      )}
      <div className="split">
        <section className="panel">
          <div className="section-head row spread">
            <h2>Budgets</h2>
            <Link className="button ghost" href="/budgets">
              Manage <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          {report.limits.length ? (
            report.limits.map((item) => (
              <BudgetBar
                key={item.id}
                label={item.name}
                spent={item.spentPaise}
                limit={item.limitPaise}
                percent={item.percent}
                currency={options.currency}
              />
            ))
          ) : (
            <p className="empty-copy">
              Set a monthly limit to see your progress here.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Spending by category</h2>
          {report.spending.length ? (
            <ul className="rule-list">
              {report.spending.map((item) => (
                <li key={item.categoryId} className="row spread">
                  <span>{item.name}</span>
                  <Money amount={item.amount} currency={options.currency} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No expenses this month.</p>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Six-month trend</h2>
        {report.trend.some((item) => item.expense || item.income) ? (
          <Trend data={report.trend} currency={options.currency} />
        ) : (
          <p className="empty-copy">
            Income and spending will appear here as you add transactions.
          </p>
        )}
      </section>
      <section className="panel">
        <div className="section-head row spread">
          <h2>Latest transactions</h2>
          <Link href="/transactions" className="button ghost">
            View all <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
        <TransactionFeed
          entries={report.latest}
          options={options}
          currency={options.currency}
        />
      </section>
    </div>
  );
}
