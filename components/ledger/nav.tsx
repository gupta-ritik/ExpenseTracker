"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import {
  ArrowDownUp,
  BarChart3,
  CircleGauge,
  Import,
  Inbox,
  LineChart,
  LogOut,
  Settings,
  Wallet,
  Target,
  Repeat,
} from "lucide-react";
import { useState } from "react";

const authClient = createAuthClient();
const primary = [
  { label: "Dashboard", href: "/dashboard", icon: CircleGauge },
  { label: "Transactions", href: "/transactions", icon: ArrowDownUp },
  { label: "Accounts", href: "/accounts", icon: Wallet },
  { label: "Budgets", href: "/budgets", icon: Target },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];
const secondary = [
  { label: "Review", href: "/review", icon: Inbox },
  { label: "Investments", href: "/investments", icon: LineChart },
  { label: "Import", href: "/import", icon: Import },
  { label: "Recurring", href: "/recurring", icon: Repeat },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Navigation({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const item = ({ label, href, icon: Icon }: (typeof primary)[number]) => (
    <Link
      className="nav-item"
      aria-current={pathname === href ? "page" : undefined}
      href={href}
      key={href}
    >
      <Icon size={19} aria-hidden />
      {label}
    </Link>
  );
  async function signOut() {
    setBusy(true);
    setStatus("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setStatus("Sign-out failed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <aside className="desk-nav">
        <Link className="brand" href="/dashboard">
          <span aria-hidden>₹</span> ExpenseTracker
        </Link>
        <nav aria-label="Main navigation">
          {primary.map(item)}
          <hr />
          {secondary.map(item)}
        </nav>
        <div className="nav-profile">
          <span>{name}</span>
          <button className="button ghost" disabled={busy} onClick={signOut}>
            <LogOut size={18} /> Sign out
          </button>
          {status && <p role="alert">{status}</p>}
        </div>
      </aside>
      <div className="mobile-top">
        <Link href="/dashboard" className="brand">
          <span aria-hidden>₹</span> ExpenseTracker
        </Link>
        <button
          className="button ghost"
          disabled={busy}
          onClick={signOut}
          aria-label="Sign out"
        >
          <LogOut size={20} />
        </button>
        {status && <span role="alert">{status}</span>}
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {primary.slice(0, 4).map(item)}
        {item(secondary[secondary.length - 1])}
      </nav>
    </>
  );
}
