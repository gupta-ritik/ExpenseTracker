"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "../auth";
import { db } from "../db";
import { candidateImports } from "../db/queries/import";
import { accounts, categories, transactions } from "../db/schema";
import { bankPresets, importFingerprint, parseStatement } from "./csv";

const column = z.number().int().min(0).max(100).optional();
const importInput = z.object({
  csv: z.string().min(1).max(750_000),
  preset: z.enum(bankPresets),
  mapping: z.object({
    date: column, description: column, debit: column, credit: column, amount: column, direction: column,
  }).optional(),
});

async function plan(userId: string, raw: unknown) {
  const input = importInput.safeParse(raw);
  if (!input.success) return { error: "Upload a valid CSV of up to 750 KB and check the column mapping." } as const;
  const parsed = parseStatement(input.data.csv, input.data.preset, input.data.mapping);
  if (parsed.mappingError) return { error: parsed.mappingError } as const;
  if (parsed.entries.length + parsed.errors.length > 3000) return { error: "Import up to 3,000 rows at a time." } as const;
  const entries = parsed.entries.filter(row => row.note.length <= 300).map(row => {
    const fingerprint = importFingerprint(row);
    return { ...row, fingerprint, hash: createHash("sha256").update(fingerprint).digest("hex") };
  });
  const longNotes = parsed.entries.filter(row => row.note.length > 300)
    .map(row => ({ line: row.line, message: "Keep descriptions under 300 characters." }));
  const [existingRows, previousImports] = await candidateImports(
    userId, Array.from(new Set(entries.map(row => row.date))), Array.from(new Set(entries.map(row => row.hash))),
  );
  const existing = new Set(existingRows.flatMap(row =>
    row.type === "transfer" ? [] : [importFingerprint({ ...row, type: row.type })]
  ));
  const hashes = new Set(previousImports.map(row => row.hash));
  return {
    entries: entries.map(row => {
      const duplicate = existing.has(row.fingerprint) || hashes.has(row.hash);
      existing.add(row.fingerprint);
      return { ...row, duplicate };
    }),
    errors: [...parsed.errors, ...longNotes].sort((a, b) => a.line - b.line),
  } as const;
}

export async function previewImport(raw: unknown) {
  const { id } = await requireUser();
  const result = await plan(id, raw);
  if ("error" in result) return result;
  return {
    entries: result.entries.map(({ line, date, note, amountPaise, type, duplicate }) =>
      ({ line, date, note, amountPaise, type, duplicate })),
    errors: result.errors,
  };
}

export async function confirmImport(raw: unknown, accountId: string) {
  const { id: userId } = await requireUser();
  if (!z.uuid().safeParse(accountId).success || !await db().$count(accounts, and(
    eq(accounts.userId, userId), eq(accounts.id, accountId),
  ))) return { error: "Choose one of your accounts." } as const;
  const result = await plan(userId, raw);
  if ("error" in result) return result;
  const fresh = result.entries.filter(row => !row.duplicate);
  if (!fresh.length) return { imported: 0, duplicates: result.entries.length } as const;
  try {
    const count = await db().transaction(async (tx) => {
      await tx.insert(categories).values([
        { userId, name: "Other", type: "expense" },
        { userId, name: "Other", type: "income" },
      ]).onConflictDoNothing();
      const defaults = await tx.select({ id: categories.id, type: categories.type }).from(categories).where(and(
        eq(categories.userId, userId), eq(categories.name, "Other"),
      ));
      const byType = new Map(defaults.map(item => [item.type, item.id]));
      let imported = 0;
      for (let offset = 0; offset < fresh.length; offset += 500) {
        const inserted = await tx.insert(transactions).values(fresh.slice(offset, offset + 500).map(row => ({
          userId, accountId, source: "csv" as const, importHash: row.hash,
          note: row.note, date: row.date, type: row.type, amountPaise: row.amountPaise,
          categoryId: byType.get(row.type),
        }))).onConflictDoNothing({ target: [transactions.userId, transactions.importHash] }).returning({ id: transactions.id });
        imported += inserted.length;
      }
      return imported;
    });
    for (const path of ["/dashboard", "/transactions", "/accounts", "/budgets", "/reports"]) revalidatePath(path);
    return { imported: count, duplicates: result.entries.length - count } as const;
  } catch (error) {
    console.error("Could not import statement", error instanceof Error ? error.message : error);
    return { error: "The statement could not be imported. Try again." } as const;
  }
}
