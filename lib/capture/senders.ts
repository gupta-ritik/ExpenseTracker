import { eq } from "drizzle-orm";
import { db } from "../db";
import { userPreferences } from "../db/schema";
import { bankSenders } from "./alerts";

export const defaultSmsSenders = bankSenders.map((item) => `*-${item}`);

export async function getSmsSenders(userId: string) {
  const [row] = await db()
    .select({ senders: userPreferences.smsSenders })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return row?.senders?.length ? row.senders : defaultSmsSenders;
}

/** Sender IDs are 3–11 alphanumerics, optionally with the "*-" operator wildcard. */
export function cleanSenders(input: string) {
  return [
    ...new Set(
      input
        .split(/[\s,]+/)
        .map((item) => item.trim().toUpperCase())
        .filter((item) => /^(?:\*-)?[A-Z0-9]{3,11}$/.test(item)),
    ),
  ].slice(0, 100);
}

export async function setSmsSenders(userId: string, senders: string[]) {
  await db()
    .insert(userPreferences)
    .values({ userId, smsSenders: senders })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { smsSenders: senders },
    });
}
