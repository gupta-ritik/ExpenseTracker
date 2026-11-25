import { formatDistanceToNowStrict } from "date-fns";

type Job = {
  id: string;
  source: string;
  fileName: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  rowsFound: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsReview: number;
  status: string;
  error: string | null;
  createdAt: Date;
};

const statusText: Record<string, string> = {
  running: "Running",
  done: "Done",
  failed: "Failed",
  needs_password: "Needs password",
  needs_ai_retry: "Retry later",
};

export function ImportJobs({
  jobs,
  lastSync,
}: {
  jobs: Job[];
  lastSync: Date | null;
}) {
  return (
    <section className="panel stack">
      <div className="row spread wrap-row">
        <h2>Jobs</h2>
        <p className="mono">
          {lastSync
            ? `Last email sync: ${formatDistanceToNowStrict(lastSync)} ago`
            : "Email not connected"}
        </p>
      </div>
      {jobs.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>File</th>
                <th>Period</th>
                <th>Found</th>
                <th>New</th>
                <th>Dup.</th>
                <th>Review</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className={job.status === "failed" ? "duplicate" : undefined}
                >
                  <td className="mono">[{job.source.toUpperCase()}]</td>
                  <td>{job.fileName ?? "—"}</td>
                  <td className="mono">
                    {job.periodFrom
                      ? `${job.periodFrom} → ${job.periodTo ?? ""}`
                      : "—"}
                  </td>
                  <td className="mono">{job.rowsFound}</td>
                  <td className="mono">{job.rowsInserted}</td>
                  <td className="mono">{job.rowsDuplicate}</td>
                  <td className="mono">{job.rowsReview}</td>
                  <td>
                    {statusText[job.status] ?? job.status}
                    {job.error && (
                      <>
                        <br />
                        <span className="field-error">{job.error}</span>
                      </>
                    )}
                  </td>
                  <td className="mono">
                    <time dateTime={job.createdAt.toISOString()}>
                      {formatDistanceToNowStrict(job.createdAt)} ago
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-copy">
          Imports, synced emails and SMS will be listed here.
        </p>
      )}
    </section>
  );
}
