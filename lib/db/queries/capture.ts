import { desc, eq, max } from "drizzle-orm";
import { db } from "..";
import { importJobs, mailConnections } from "../schema";

export function getImportJobs(userId: string, limit = 25) {
  return db()
    .select({
      id: importJobs.id,
      source: importJobs.source,
      fileName: importJobs.fileName,
      periodFrom: importJobs.periodFrom,
      periodTo: importJobs.periodTo,
      rowsFound: importJobs.rowsFound,
      rowsInserted: importJobs.rowsInserted,
      rowsDuplicate: importJobs.rowsDuplicate,
      rowsReview: importJobs.rowsReview,
      status: importJobs.status,
      error: importJobs.error,
      createdAt: importJobs.createdAt,
    })
    .from(importJobs)
    .where(eq(importJobs.userId, userId))
    .orderBy(desc(importJobs.createdAt))
    .limit(limit);
}

/** Connection details for settings. The encrypted password is never selected. */
export function getMailConnections(userId: string) {
  return db()
    .select({
      id: mailConnections.id,
      imapHost: mailConnections.imapHost,
      imapPort: mailConnections.imapPort,
      imapUser: mailConnections.imapUser,
      senders: mailConnections.senders,
      lastSyncAt: mailConnections.lastSyncAt,
      lastError: mailConnections.lastError,
      enabled: mailConnections.enabled,
      pdfPasswordsEnc: mailConnections.pdfPasswordsEnc,
    })
    .from(mailConnections)
    .where(eq(mailConnections.userId, userId))
    .then((rows) =>
      rows.map(({ pdfPasswordsEnc, ...row }) => ({
        ...row,
        pdfPasswordSenders: Object.keys(pdfPasswordsEnc ?? {}),
      })),
    );
}

export async function lastEmailSync(userId: string) {
  const [row] = await db()
    .select({ at: max(mailConnections.lastSyncAt) })
    .from(mailConnections)
    .where(eq(mailConnections.userId, userId));
  return row?.at ?? null;
}
