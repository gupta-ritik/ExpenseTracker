import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { mailConnections } from "../db/schema";
import { bankEmailSenders } from "./alerts";
import { decryptSecret, encryptSecret } from "./crypto";
import { importDocument } from "./documents";
import { captureMessages } from "./messages";

export type ImapSettings = {
  host: string;
  port: number;
  user: string;
  password: string;
};
type Connection = typeof mailConnections.$inferSelect;
export type MailClient = Pick<
  ImapFlow,
  "connect" | "logout" | "mailboxOpen" | "search" | "fetch" | "mailbox"
>;
export type ClientFactory = (settings: ImapSettings) => MailClient;

const batchSize = 20;
const maxMessageBytes = 12 * 1024 * 1024;

export const defaultClient: ClientFactory = (settings) =>
  new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 993,
    auth: { user: settings.user, pass: settings.password },
    logger: false,
    emitLogs: false,
    socketTimeout: 30_000,
    greetingTimeout: 10_000,
  });

function safeError(error: unknown) {
  const text = error instanceof Error ? error.message : "Connection failed.";
  if (/auth|credential|invalid|login/i.test(text))
    return "Sign-in failed. Check the IMAP user and app password.";
  if (/timeout|ETIMEDOUT|ENOTFOUND|ECONNREFUSED/i.test(text))
    return "The mail server could not be reached.";
  return "The mailbox could not be read.";
}

/** Opens INBOX read-only to prove the settings work. Nothing is fetched. */
export async function testImap(
  settings: ImapSettings,
  factory: ClientFactory = defaultClient,
) {
  const client = factory(settings);
  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: safeError(error) };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function saveMailConnection(
  userId: string,
  settings: ImapSettings,
  senders: string[] = [...bankEmailSenders],
) {
  const values = {
    imapHost: settings.host,
    imapPort: settings.port,
    imapUser: settings.user,
    passwordEnc: encryptSecret(settings.password),
    senders: senders
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 50),
    enabled: true,
    lastError: null,
  };
  const [row] = await db()
    .insert(mailConnections)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: [
        mailConnections.userId,
        mailConnections.imapHost,
        mailConnections.imapUser,
      ],
      set: values,
    })
    .returning({ id: mailConnections.id });
  return row.id;
}

function savedPdfPassword(connection: Connection, sender: string) {
  const sealed =
    connection.pdfPasswordsEnc?.[sender.toLowerCase()] ??
    connection.pdfPasswordsEnc?.["*"];
  if (!sealed) return undefined;
  try {
    return decryptSecret(sealed);
  } catch {
    return undefined;
  }
}

/**
 * Syncs one connection until the deadline. Only bank senders are searched, only
 * messages after lastUid are read, and bodies are parsed in memory and dropped.
 * lastUid is saved after every batch so a timeout never repeats work.
 */
export async function syncConnection(
  connection: Connection,
  deadline: number,
  factory: ClientFactory = defaultClient,
) {
  const totals = {
    messages: 0,
    inserted: 0,
    duplicates: 0,
    review: 0,
    documents: 0,
    done: true,
  };
  let client: MailClient | undefined;
  const owned = and(
    eq(mailConnections.userId, connection.userId),
    eq(mailConnections.id, connection.id),
  );
  try {
    client = factory({
      host: connection.imapHost,
      port: connection.imapPort,
      user: connection.imapUser,
      password: decryptSecret(connection.passwordEnc),
    });
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });
    const mailbox = client.mailbox;
    const validity =
      mailbox && typeof mailbox === "object"
        ? String(mailbox.uidValidity)
        : null;
    let lastUid =
      validity && connection.uidValidity && connection.uidValidity !== validity
        ? 0
        : connection.lastUid;
    const senders = connection.senders.length
      ? connection.senders
      : [...bankEmailSenders];
    const query = {
      or: senders.map((from) => ({ from })),
      ...(lastUid
        ? { uid: `${lastUid + 1}:*` }
        : { since: new Date(Date.now() - 30 * 86_400_000) }),
    };
    const uids = ((await client.search(query, { uid: true })) || [])
      .filter((uid) => uid > lastUid)
      .sort((a, b) => a - b);
    for (let offset = 0; offset < uids.length; offset += batchSize) {
      if (Date.now() > deadline) {
        totals.done = false;
        break;
      }
      const batch = uids.slice(offset, offset + batchSize);
      const messages: { text: string; sender: string; receivedAt: Date }[] = [];
      for await (const message of client.fetch(
        batch.join(","),
        { uid: true, size: true, source: true, envelope: true },
        { uid: true },
      )) {
        if (!message.source || (message.size ?? 0) > maxMessageBytes) continue;
        const parsed = await simpleParser(message.source, {
          skipImageLinks: true,
          skipTextToHtml: true,
        });
        const sender = parsed.from?.value[0]?.address?.toLowerCase() ?? "";
        const text = (
          parsed.text ||
          (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, " ") : "")
        )
          .replace(/\s+/g, " ")
          .trim();
        if (text)
          messages.push({
            text: text.slice(0, 4000),
            sender,
            receivedAt: parsed.date ?? new Date(),
          });
        for (const attachment of parsed.attachments) {
          if (
            attachment.contentType !== "application/pdf" &&
            !/\.pdf$/i.test(attachment.filename ?? "")
          )
            continue;
          totals.documents++;
          await importDocument({
            userId: connection.userId,
            data: new Uint8Array(attachment.content),
            password: savedPdfPassword(connection, sender),
            fileName: attachment.filename ?? "attachment.pdf",
            mailConnectionId: connection.id,
            messageUid: message.uid,
          });
        }
      }
      if (messages.length) {
        const result = await captureMessages({
          userId: connection.userId,
          source: "email",
          messages,
          trustedSender: true,
          job: {
            mailConnectionId: connection.id,
            messageUid: batch.at(-1),
            fileName: `${messages.length} alert emails`,
          },
        });
        totals.inserted += result.inserted;
        totals.duplicates += result.duplicates;
        totals.review += result.review;
      }
      totals.messages += messages.length;
      lastUid = batch.at(-1)!;
      await db()
        .update(mailConnections)
        .set({
          lastUid,
          uidValidity: validity,
          lastSyncAt: new Date(),
          lastError: null,
        })
        .where(owned);
    }
    await db()
      .update(mailConnections)
      .set({ lastSyncAt: new Date(), lastError: null, uidValidity: validity })
      .where(owned);
  } catch (error) {
    await db()
      .update(mailConnections)
      .set({ lastSyncAt: new Date(), lastError: safeError(error) })
      .where(owned);
    totals.done = false;
  } finally {
    await client?.logout().catch(() => undefined);
  }
  return totals;
}

export async function syncAll(
  deadline: number,
  factory?: ClientFactory,
  userId?: string,
) {
  const connections = await db()
    .select()
    .from(mailConnections)
    .where(
      and(
        eq(mailConnections.enabled, true),
        userId ? eq(mailConnections.userId, userId) : undefined,
      ),
    );
  const results = [];
  for (const connection of connections) {
    if (Date.now() > deadline) break;
    results.push({
      id: connection.id,
      ...(await syncConnection(connection, deadline, factory)),
    });
  }
  return { connections: connections.length, results };
}
