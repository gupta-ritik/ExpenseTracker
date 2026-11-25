"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "../auth";
import { db } from "../db";
import { accounts, mailConnections } from "../db/schema";
import { splitMessages } from "./alerts";
import { encryptionAvailable, encryptSecret } from "./crypto";
import { importDocument, previewDocument } from "./documents";
import { saveMailConnection, syncAll, testImap } from "./email";
import { captureMessages, previewMessages } from "./messages";
import { approveEntry, recategorize, rejectEntry } from "./review";
import { cleanSenders, setSmsSenders } from "./senders";
import { createIngestToken, revokeIngestToken } from "./tokens";
import { maxPdfBytes } from "./pdf/extract";

function refresh(...paths: string[]) {
  for (const path of [
    "/dashboard",
    "/transactions",
    "/review",
    "/import",
    "/settings",
    "/investments",
    ...paths,
  ])
    revalidatePath(path);
}

const pasted = z.string().trim().min(1).max(20_000);

/** Preview pasted SMS: masked results only, nothing stored. */
export async function previewPastedSms(text: unknown) {
  await requireUser();
  const parsed = pasted.safeParse(text);
  if (!parsed.success)
    return { error: "Paste up to 20,000 characters of SMS text." } as const;
  const messages = splitMessages(parsed.data)
    .slice(0, 100)
    .map((item) => ({ text: item, sender: "", receivedAt: new Date() }));
  return {
    items: previewMessages(messages).map((outcome, index) => ({
      index,
      status: outcome.status,
      reason: outcome.reason,
      row: outcome.row && {
        type: outcome.row.type,
        amountPaise: outcome.row.amountPaise,
        date: outcome.row.date,
        merchant: outcome.row.merchant,
        bankName: outcome.row.bankName,
        last4: outcome.row.last4,
      },
    })),
  };
}

export async function savePastedSms(text: unknown) {
  const { id: userId } = await requireUser();
  const parsed = pasted.safeParse(text);
  if (!parsed.success)
    return { error: "Paste up to 20,000 characters of SMS text." } as const;
  const messages = splitMessages(parsed.data)
    .slice(0, 100)
    .map((item) => ({ text: item, sender: "", receivedAt: new Date() }));
  try {
    const result = await captureMessages({
      userId,
      source: "sms",
      messages,
      trustedSender: true,
    });
    refresh();
    return {
      inserted: result.inserted,
      duplicates: result.duplicates,
      review: result.review,
      ignored: result.ignored + result.unknown,
    } as const;
  } catch {
    return { error: "The messages could not be saved. Try again." } as const;
  }
}

const uuid = z.uuid();

export async function approveReview(id: string) {
  const { id: userId } = await requireUser();
  if (!uuid.safeParse(id).success || !(await approveEntry(userId, id)))
    return { error: "This item is no longer waiting for review." } as const;
  refresh();
  return { ok: true } as const;
}

export async function rejectReview(id: string) {
  const { id: userId } = await requireUser();
  if (!uuid.safeParse(id).success || !(await rejectEntry(userId, id)))
    return { error: "This item is no longer waiting for review." } as const;
  refresh();
  return { ok: true } as const;
}

export async function changeReviewCategory(
  id: string,
  categoryId: string,
  always: boolean,
) {
  const { id: userId } = await requireUser();
  if (
    !uuid.safeParse(id).success ||
    !uuid.safeParse(categoryId).success ||
    typeof always !== "boolean"
  )
    return { error: "Choose a category." } as const;
  const result = await recategorize(userId, id, categoryId, always);
  if (!result.ok) return { error: result.error } as const;
  refresh();
  return { ok: true, pattern: result.pattern } as const;
}

export async function createToken(name: unknown) {
  const { id: userId } = await requireUser();
  const parsed = z.string().trim().min(1).max(80).safeParse(name);
  if (!parsed.success)
    return { error: "Name the token, for example “Pixel forwarder”." } as const;
  const token = await createIngestToken(userId, parsed.data);
  revalidatePath("/settings");
  return {
    id: token.id,
    token: token.token,
    name: token.name,
    createdAt: token.createdAt,
  } as const;
}

export async function revokeToken(id: string) {
  const { id: userId } = await requireUser();
  if (!uuid.safeParse(id).success || !(await revokeIngestToken(userId, id)))
    return { error: "Token could not be found." } as const;
  revalidatePath("/settings");
  return { ok: true } as const;
}

export async function saveSmsSenders(text: unknown) {
  const { id: userId } = await requireUser();
  const senders = cleanSenders(typeof text === "string" ? text : "");
  if (!senders.length)
    return { error: "Add at least one sender ID such as *-HDFCBK." } as const;
  await setSmsSenders(userId, senders);
  revalidatePath("/settings");
  return { ok: true, count: senders.length } as const;
}

const imapInput = z.object({
  host: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9.-]+$/i),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().trim().min(3).max(200),
  password: z.string().min(4).max(200),
  senders: z.string().max(4000).optional(),
});

/** Tests the IMAP login read-only, then stores the app password encrypted. */
export async function connectEmail(raw: unknown) {
  const { id: userId } = await requireUser();
  if (!encryptionAvailable())
    return { error: "Email capture is off: add ENCRYPTION_KEY." } as const;
  const parsed = imapInput.safeParse(raw);
  if (!parsed.success)
    return {
      error: "Check the IMAP host, port, user and app password.",
    } as const;
  const tested = await testImap(parsed.data);
  if (!tested.ok) return { error: tested.error } as const;
  const senders = parsed.data.senders
    ?.split(/[\s,]+/)
    .filter((item) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(item));
  await saveMailConnection(
    userId,
    parsed.data,
    senders?.length ? senders : undefined,
  );
  revalidatePath("/settings");
  return { ok: true } as const;
}

export async function disconnectEmail(id: string) {
  const { id: userId } = await requireUser();
  if (!uuid.safeParse(id).success)
    return { error: "Connection could not be found." } as const;
  await db()
    .delete(mailConnections)
    .where(and(eq(mailConnections.userId, userId), eq(mailConnections.id, id)));
  revalidatePath("/settings");
  return { ok: true } as const;
}

/** Opt-in: saves an encrypted PDF password for statements from one sender ("*" for any). */
export async function savePdfPassword(
  connectionId: string,
  sender: unknown,
  password: unknown,
) {
  const { id: userId } = await requireUser();
  if (!encryptionAvailable())
    return { error: "Add ENCRYPTION_KEY to save PDF passwords." } as const;
  const from = z
    .union([z.literal("*"), z.email()])
    .safeParse(
      typeof sender === "string" ? sender.trim().toLowerCase() : sender,
    );
  const secret = z.string().min(1).max(100).safeParse(password);
  if (!uuid.safeParse(connectionId).success || !from.success || !secret.success)
    return {
      error: "Enter a sender email (or *) and the PDF password.",
    } as const;
  const owned = and(
    eq(mailConnections.userId, userId),
    eq(mailConnections.id, connectionId),
  );
  const [connection] = await db()
    .select({ saved: mailConnections.pdfPasswordsEnc })
    .from(mailConnections)
    .where(owned);
  if (!connection) return { error: "Connection could not be found." } as const;
  await db()
    .update(mailConnections)
    .set({
      pdfPasswordsEnc: {
        ...(connection.saved ?? {}),
        [from.data]: encryptSecret(secret.data),
      },
    })
    .where(owned);
  revalidatePath("/settings");
  return { ok: true } as const;
}

export async function syncEmailNow() {
  const { id: userId } = await requireUser();
  const summary = await syncAll(Date.now() + 40_000, undefined, userId);
  refresh();
  const totals = summary.results.reduce(
    (sum, item) => ({
      messages: sum.messages + item.messages,
      inserted: sum.inserted + item.inserted,
      duplicates: sum.duplicates + item.duplicates,
      review: sum.review + item.review,
    }),
    { messages: 0, inserted: 0, duplicates: 0, review: 0 },
  );
  return { connections: summary.connections, ...totals } as const;
}

async function readUpload(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File))
    return { ok: false, error: "Choose a PDF." } as const;
  if (file.size > maxPdfBytes)
    return { ok: false, error: "Upload a PDF of up to 10 MB." } as const;
  const password = form.get("password");
  return {
    ok: true,
    data: new Uint8Array(await file.arrayBuffer()),
    name: file.name.slice(0, 200),
    password: typeof password === "string" && password ? password : undefined,
  } as const;
}

const kinds = z.enum(["statement", "cas"]);

/** Parses an uploaded PDF in memory. The file and password are discarded after the call. */
export async function previewPdf(form: FormData) {
  const { id: userId } = await requireUser();
  const upload = await readUpload(form);
  if (!upload.ok) return { error: upload.error } as const;
  const kind = kinds.safeParse(form.get("kind"));
  return previewDocument(
    userId,
    upload.data,
    upload.password,
    kind.success ? kind.data : undefined,
  );
}

export async function importPdf(form: FormData) {
  const { id: userId } = await requireUser();
  const upload = await readUpload(form);
  if (!upload.ok) return { error: upload.error } as const;
  const kind = kinds.safeParse(form.get("kind"));
  const accountId = form.get("accountId");
  if (kind.success && kind.data === "statement") {
    if (
      typeof accountId !== "string" ||
      !uuid.safeParse(accountId).success ||
      !(await db().$count(
        accounts,
        and(eq(accounts.userId, userId), eq(accounts.id, accountId)),
      ))
    ) {
      return { error: "Choose one of your accounts." } as const;
    }
  }
  try {
    const result = await importDocument({
      userId,
      data: upload.data,
      password: upload.password,
      fileName: upload.name,
      accountId:
        typeof accountId === "string" && accountId ? accountId : undefined,
      expected: kind.success ? kind.data : undefined,
    });
    refresh("/accounts", "/reports", "/budgets");
    return result;
  } catch {
    return { error: "The PDF could not be imported. Try again." } as const;
  }
}
