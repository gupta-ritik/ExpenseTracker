import { ImportForm } from "../../../components/ledger/import-form";
import { PageHeading } from "../../../components/ledger/shared";
import { requireUser } from "../../../lib/auth";
import { getOptions } from "../../../lib/db/queries/ledger";

export const metadata = { title: "Import statement" };

export default async function ImportPage() {
  const { id } = await requireUser();
  const options = await getOptions(id);
  return <>
    <PageHeading title="Import bank CSV" />
    <ImportForm accounts={options.accounts} currency={options.currency} />
  </>;
}
