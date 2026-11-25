import { DocumentImport } from "../../../components/ledger/document-import";
import { ImportForm } from "../../../components/ledger/import-form";
import { ImportJobs } from "../../../components/ledger/import-jobs";
import { ImportTabs } from "../../../components/ledger/import-tabs";
import { PageHeading } from "../../../components/ledger/shared";
import { requireUser } from "../../../lib/auth";
import { aiEnabled } from "../../../lib/capture/groq";
import { getImportJobs, lastEmailSync } from "../../../lib/db/queries/capture";
import { getOptions } from "../../../lib/db/queries/ledger";

export const metadata = { title: "Import statement" };

export default async function ImportPage() {
  const { id } = await requireUser();
  const [options, jobs, lastSync] = await Promise.all([
    getOptions(id),
    getImportJobs(id),
    lastEmailSync(id),
  ]);
  const ai = aiEnabled();
  return (
    <div className="stack">
      <PageHeading title="Import" label="// CSV · PDF · CAS" />
      <ImportTabs
        panels={{
          csv: (
            <ImportForm
              accounts={options.accounts}
              currency={options.currency}
            />
          ),
          statement: (
            <DocumentImport
              kind="statement"
              accounts={options.accounts}
              currency={options.currency}
              aiEnabled={ai}
            />
          ),
          cas: (
            <DocumentImport
              kind="cas"
              accounts={options.accounts}
              currency={options.currency}
              aiEnabled={ai}
            />
          ),
        }}
      />
      <ImportJobs jobs={jobs} lastSync={lastSync} />
    </div>
  );
}
