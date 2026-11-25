import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { eq } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { db } from "../../lib/db";
import { databasePool } from "../../lib/db/connection";
import { user } from "../../lib/db/auth-schema";
import { aiUsage, transactions } from "../../lib/db/schema";
import { seedDefaults } from "../../lib/expense/defaults";
import { captureMessages } from "../../lib/capture/messages";
import { loadTestEnvironment } from "../../scripts/test-environment";

// Only the Groq settings are read from .env.local; the database is always the Neon test branch.
const local = existsSync(".env.local")
  ? (parseEnv(readFileSync(".env.local", "utf8")) as Record<string, string>)
  : {};
const key = process.env.GROQ_API_KEY || local.GROQ_API_KEY;
const userId = randomUUID();
let connected = false;

afterAll(async () => {
  if (!connected) return;
  await db().delete(user).where(eq(user.id, userId));
  await databasePool().end();
});

it.skipIf(!key || !existsSync(".env.test"))(
  "parses an unknown bank alert format with Groq and logs ai_usage",
  async () => {
    loadTestEnvironment();
    connected = true;
    process.env.GROQ_API_KEY = key;
    if (local.GROQ_MODEL) process.env.GROQ_MODEL = local.GROQ_MODEL;
    await db()
      .insert(user)
      .values({
        id: userId,
        name: "Groq live test",
        email: `${userId}@expense.local`,
      });
    await seedDefaults(userId);
    // A synthetic format none of the regex templates know.
    const text =
      "HDFC Bank: Your card ending 5678 was used for a purchase worth INR 640.00 with merchant BLUE TOKAI COFFEE on 24 Nov. Txn ID 7781234.";
    const result = await captureMessages({
      userId,
      source: "sms",
      messages: [
        {
          text,
          sender: "VM-HDFCBK",
          receivedAt: new Date("2026-11-25T10:00:00+05:30"),
        },
      ],
    });
    const usage = await db()
      .select({
        feature: aiUsage.feature,
        model: aiUsage.model,
        inputTokens: aiUsage.inputTokens,
        outputTokens: aiUsage.outputTokens,
        ok: aiUsage.ok,
      })
      .from(aiUsage)
      .where(eq(aiUsage.userId, userId));
    console.log("ai_usage:", JSON.stringify(usage));
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ feature: "alert", ok: true });
    expect(usage[0].inputTokens).toBeGreaterThan(0);
    expect(result.inserted + result.aiRetry).toBe(1);
    if (result.inserted) {
      const [row] = await db()
        .select({
          amountPaise: transactions.amountPaise,
          status: transactions.status,
          confidence: transactions.confidence,
        })
        .from(transactions)
        .where(eq(transactions.userId, userId));
      console.log("parsed row:", JSON.stringify(row));
      expect(row).toMatchObject({
        amountPaise: 64_000,
        status: "needs_review",
      });
      expect(row.confidence).toBeLessThanOrEqual(70);
    }
  },
  60_000,
);
