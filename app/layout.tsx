import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/archivo-black/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ExpenseTracker", template: "%s · ExpenseTracker" },
  description: "Track expenses, import Indian bank statements, and manage monthly budgets in rupees.",
  openGraph: {
    title: "ExpenseTracker",
    description: "Track expenses, import Indian bank statements, and manage monthly budgets in rupees.",
    type: "website",
  },
  other: { "page-type": "software", "site-kind": "software" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" data-type="software" data-radius="sharp">
      <body><a className="skip-link" href="#main">Skip to content</a>{children}</body>
    </html>
  );
}
