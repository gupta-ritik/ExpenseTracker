import Link from "next/link";
import { ArrowRight, FileUp, LockKeyhole, Plus, Target } from "lucide-react";

const features = [
  {
    icon: LockKeyhole,
    title: "Private and free",
    body: "One private ledger for your accounts. Start free with an email address.",
  },
  {
    icon: Plus,
    title: "Quick add",
    body: "Press N on the dashboard to log an expense, income or a transfer.",
  },
  {
    icon: FileUp,
    title: "Bank statement import",
    body: "Preview CSV entries from five Indian banks and skip rows you already imported.",
  },
  {
    icon: Target,
    title: "Budgets and reports",
    body: "Set monthly spending limits and see which categories take the biggest share.",
  },
];

function FeaturePreview({ title }: { title: string }) {
  if (title === "Private and free")
    return (
      <div className="feature-preview">
        <div className="row">
          <LockKeyhole size={18} aria-hidden />
          <strong>Private ledger</strong>
        </div>
        <span className="mono">Email + password</span>
        <span>CSV export available</span>
      </div>
    );
  if (title === "Quick add")
    return (
      <div className="feature-preview">
        <span className="mono">AMOUNT</span>
        <strong className="money">₹250.50</strong>
        <span>Expense / Food</span>
      </div>
    );
  if (title === "Bank statement import")
    return (
      <div className="feature-preview">
        <div className="row">
          <FileUp size={18} aria-hidden />
          <strong>SBI statement</strong>
        </div>
        <span className="mono">New · 2</span>
        <span className="mono">Duplicate · 1</span>
      </div>
    );
  return (
    <div className="feature-preview">
      <div className="row spread">
        <strong>Groceries</strong>
        <span className="mono">64%</span>
      </div>
      <progress
        max={100}
        value={64}
        aria-label="Example groceries limit used"
      />
      <span className="money">₹1,920.00 of ₹3,000.00</span>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className="nav landing-nav wrap">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Link href="/" className="brand">
          <span aria-hidden>₹</span> ExpenseTracker
        </Link>
        <Link href="/sign-in" className="button">
          Sign in
        </Link>
      </header>
      <main id="main">
        <section className="hero" data-enter>
          <div className="wrap hero-grid">
            <div className="hero-text hero-copy">
              <p className="section-label mono">
                {"// PERSONAL FINANCE · INDIA"}
              </p>
              <h1>Track your expenses in rupees.</h1>
              <p>
                Log everyday spending, import your bank statement, and see what
                you have left in this month’s budget.
              </p>
              <Link href="/sign-up" className="button primary">
                Start free <ArrowRight size={20} aria-hidden />
              </Link>
            </div>
            <div
              className="app-frame panel"
              data-visual
              role="img"
              aria-label="Example monthly overview"
            >
              <div className="frame-title row spread">
                <span className="mono">{"// THIS MONTH"}</span>
                <span className="mono">INR</span>
              </div>
              <div className="frame-total">
                <span className="mono">TOTAL BALANCE</span>
                <strong className="money">₹47,280.50</strong>
              </div>
              <div className="frame-metrics">
                <div>
                  <span className="mono">SPENDING</span>
                  <strong className="money text-expense">₹18,420.00</strong>
                </div>
                <div>
                  <span className="mono">INCOME</span>
                  <strong className="money text-income">₹65,700.50</strong>
                </div>
              </div>
              <div className="frame-budget">
                <div className="row spread">
                  <strong>Groceries</strong>
                  <span className="mono">64%</span>
                </div>
                <progress
                  value={64}
                  max={100}
                  aria-label="Example groceries budget used"
                />
              </div>
            </div>
          </div>
        </section>
        <section className="features" id="features">
          <div className="wrap">
            <h2 data-moment="letters-assemble">
              <span>Tools for</span> <span>your daily ledger</span>
            </h2>
            <div className="feature-grid">
              {features.map(({ icon: Icon, title, body }) => (
                <article key={title}>
                  <Icon size={26} aria-hidden />
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <FeaturePreview title={title} />
                </article>
              ))}
            </div>
            <div className="features-action">
              <Link href="/sign-up" className="button primary">
                Start free <ArrowRight size={20} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="wrap landing-footer">
        <span className="brand">
          <span aria-hidden>₹</span> ExpenseTracker
        </span>
        <Link href="/sign-up">
          Start free <ArrowRight size={18} aria-hidden />
        </Link>
        <Link href="/privacy">SMS privacy</Link>
      </footer>
    </>
  );
}
