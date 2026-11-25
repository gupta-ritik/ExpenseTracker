import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { getTransactions } from "../../lib/db/queries/ledger";
import { db } from "../../lib/db";
import { databasePool } from "../../lib/db/connection";
import { user } from "../../lib/db/auth-schema";
import { accounts, categories, transactions } from "../../lib/db/schema";
import { loadTestEnvironment } from "../../scripts/test-environment";

let connected = false;
afterAll(async () => { if (connected) await databasePool().end(); });
it.skipIf(!existsSync(".env.test"))("enforces user isolation in reads and foreign keys", async () => {
  loadTestEnvironment();
  connected = true;
  const a = randomUUID();
  const b = randomUUID();
  try {
    await db().insert(user).values([a, b].map(id => ({ id, name: "Isolation test", email: `${id}@expense.local` })));
    const [bank] = await db().insert(accounts).values({ userId: b, name: "Bank", type: "bank" }).returning();
    const [category] = await db().insert(categories).values({ userId: b, name: "Food", type: "expense" }).returning();
    const draft = { note: "Private expense", accountId: bank.id, categoryId: category.id, type: "expense" as const, amountPaise: 25000, date: "2026-11-24" };
    await db().insert(transactions).values({ ...draft, userId: b });
    expect((await getTransactions(a, { account: bank.id, search: draft.note }, 1)).entries).toEqual([]);
    expect((await getTransactions(b, { account: bank.id, search: draft.note }, 1)).entries[0].note).toBe(draft.note);
    await expect(db().insert(transactions).values({ ...draft, userId: a })).rejects.toThrow();
  } finally {
    await db().delete(transactions).where(and(eq(transactions.note, "Private expense"), inArray(transactions.userId, [a, b])));
    await db().delete(user).where(inArray(user.id, [a, b]));
  }
}, 25000);
