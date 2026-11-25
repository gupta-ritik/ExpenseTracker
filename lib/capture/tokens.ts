import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { ingestTokens, rateLimits } from "../db/schema";
import { newToken, sha256 } from "./crypto";

export type DeviceInfo = {
  model?: string;
  osVersion?: string;
  appVersion?: string;
};

export async function createIngestToken(
  userId: string,
  name: string,
  kind: "manual" | "device" = "manual",
  deviceInfo?: DeviceInfo,
) {
  const token = newToken();
  const [row] = await db()
    .insert(ingestTokens)
    .values({
      userId,
      name: name.slice(0, 80),
      kind,
      deviceInfo: deviceInfo ?? null,
      tokenHash: sha256(token),
    })
    .returning({
      id: ingestTokens.id,
      name: ingestTokens.name,
      kind: ingestTokens.kind,
      createdAt: ingestTokens.createdAt,
    });
  return { ...row, token };
}

export function listIngestTokens(userId: string) {
  return db()
    .select({
      id: ingestTokens.id,
      name: ingestTokens.name,
      kind: ingestTokens.kind,
      deviceInfo: ingestTokens.deviceInfo,
      lastUsedAt: ingestTokens.lastUsedAt,
      revokedAt: ingestTokens.revokedAt,
      createdAt: ingestTokens.createdAt,
    })
    .from(ingestTokens)
    .where(eq(ingestTokens.userId, userId))
    .orderBy(desc(ingestTokens.createdAt));
}

export async function revokeIngestToken(userId: string, id: string) {
  const [row] = await db()
    .update(ingestTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(ingestTokens.userId, userId),
        eq(ingestTokens.id, id),
        isNull(ingestTokens.revokedAt),
      ),
    )
    .returning({ id: ingestTokens.id });
  return Boolean(row);
}

/** Resolves a bearer token to its owner. The user id never comes from the request body. */
export async function authenticateIngest(header: string | null) {
  const token = /^Bearer\s+(et_[A-Za-z0-9_-]{43})\s*$/.exec(header ?? "")?.[1];
  if (!token) return null;
  const [row] = await db()
    .update(ingestTokens)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(ingestTokens.tokenHash, sha256(token)),
        isNull(ingestTokens.revokedAt),
      ),
    )
    .returning({ id: ingestTokens.id, userId: ingestTokens.userId });
  return row ?? null;
}

/** Fixed-window counter in Postgres. Returns true while the caller is within its limit. */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
  now = Date.now(),
) {
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const [row] = await db()
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  if (Math.random() < 0.02) {
    await db()
      .delete(rateLimits)
      .where(sql`${rateLimits.windowStart} < ${new Date(now - 60 * 60_000)}`);
  }
  return row.count <= limit;
}
