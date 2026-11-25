import type { ReactNode } from "react";
import { QuickAdd } from "../../components/ledger/entry-form";
import { Navigation } from "../../components/ledger/nav";
import { requireUser } from "../../lib/auth";
import { getOptions } from "../../lib/db/queries/ledger";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const options = await getOptions(user.id);
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <Navigation name={user.name} />
    <main id="main" className="app-main">{children}</main>
    <QuickAdd options={options} />
  </div>;
}
