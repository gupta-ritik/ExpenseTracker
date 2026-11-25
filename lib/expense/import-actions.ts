"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "../auth";
import { db } from "../db";
import { candidateImports } from "../db/queries/import";
import { accounts, categories, importJobs, transactions } from "../db/schema";
import { bankPresets, importFingerprint, parseStatement } from "./csv";
import { alertReference } from "../capture/alerts";
import { duplicateCandidates, isDuplicate } from "../capture/dedupe";

const column = z.number().int().min(0).max(100).optional();
const importInput = z.object({
  csv: z.string().min(1).max(750_000),
  preset: z.enum(bankPresets),
  mapping: z
    .object({
      date: column,
      description: column,
      debit: column,
      credit: column,
      amount: column,
      direction: column,
    })
    .optional(),
});

async function plan(userId: string, raw: unknown) {
  const input = importInput.safeParse(raw);
  if (!input.success)
    return {
      error: "Upload a valid CSV of up to 750 KB and check the column mapping.",
    } as const;
  const parsed = parseStatement(
    input.data.csv,
    input.data.preset,
    input.data.mapping,
  );
  if (parsed.mappingError) return { error: parsed.mappingError } as const;
  if (parsed.entries.length + parsed.errors.length > 3000)
    return { error: "Import up to 3,000 rows at a time." } as const;
  const entries = parsed.entries
    .filter((row) => row.note.length <= 300)
    .map((row) => {
      const fingerprint = importFingerprint(row);
      return {
        ...row,
        fingerprint,
        hash: createHash("sha256").update(fingerprint).digest("hex"),
      };
    });
  const longNotes = parsed.entries
    .filter((row) => row.note.length > 300)
    .map((row) => ({
      line: row.line,
      message: "Keep descriptions under 300 characters.",
    }));
  const [existingRows, previousImports] = await candidateImports(
    userId,
    Array.from(new Set(entries.map((row) => row.date))),
    Array.from(new Set(entries.map((row) => row.hash))),
  );
  const existing = new Set(
    existingRows.flatMap((row) =>
      row.type === "transfer"
        ? []
        : [importFingerprint({ ...row, type: row.type })],
    ),
  );
  const hashes = new Set(previousImports.map((row) => row.hash));
  // Rows captured from SMS, email or PDF: match on reference, or amount, date ±1 day and merchant.
  const asCapture = (row: (typeof entries)[number]) => ({
    type: row.type,
    amountPaise: row.amountPaise,
    date: row.date,
    merchant: row.note,
    refNo: alertReference(row.note),
  });
  const captured = await duplicateCandidates(
    db(),
    userId,
    entries.map(asCapture),
  );
  return {
    entries: entries.map((row) => {
      const duplicate =
        existing.has(row.fingerprint) ||
        hashes.has(row.hash) ||
        captured.some(
          (item) => item.merchant !== "" && isDuplicate(asCapture(row), item),
        );
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
    entries: result.entries.map(
      ({ line, date, note, amountPaise, type, duplicate }) => ({
        line,
        date,
        note,
        amountPaise,
        type,
        duplicate,
      }),
    ),
    errors: result.errors,
  };
}

export async function confirmImport(raw: unknown, accountId: string) {
  const { id: userId } = await requireUser();
  if (
    !z.uuid().safeParse(accountId).success ||
    !(await db().$count(
      accounts,
      and(eq(accounts.userId, userId), eq(accounts.id, accountId)),
    ))
  )
    return { error: "Choose one of your accounts." } as const;
  const [job] = await db()
    .insert(importJobs)
    .values({ userId, source: "csv" })
    .returning({ id: importJobs.id });
  const ownedJob = and(
    eq(importJobs.userId, userId),
    eq(importJobs.id, job.id),
  );

  try {
    const result = await plan(userId, raw);
    if ("error" in result) {
      await db()
        .update(importJobs)
        .set({ status: "failed", error: result.error })
        .where(ownedJob);
      return result;
    }
    const fresh = result.entries.filter((row) => !row.duplicate);
    const dates = result.entries.map((row) => row.date).sort();
    const count = await db().transaction(async (tx) => {
      const defaults = fresh.length
        ? await tx
            .insert(categories)
            .values([
              { userId, name: "Other", type: "expense" },
              { userId, name: "Other", type: "income" },
            ])
            .onConflictDoUpdate({
              target: [categories.userId, categories.type, categories.name],
              set: { name: "Other" },
            })
            .returning({ id: categories.id, type: categories.type })
        : [];
      const byType = new Map(defaults.map((item) => [item.type, item.id]));
      let imported = 0;
      for (let offset = 0; offset < fresh.length; offset += 500) {
        const inserted = await tx
          .insert(transactions)
          .values(
            fresh.slice(offset, offset + 500).map((row) => ({
              userId,
              accountId,
              source: "csv" as const,
              importHash: row.hash,
              note: row.note,
              date: row.date,
              type: row.type,
              amountPaise: row.amountPaise,
              categoryId: byType.get(row.type),
            })),
          )
          .onConflictDoNothing({
            target: [transactions.userId, transactions.importHash],
          })
          .returning({ id: transactions.id });
        imported += inserted.length;
      }
      await tx
        .update(importJobs)
        .set({
          status: "done",
          periodFrom: dates[0] ?? null,
          periodTo: dates.at(-1) ?? null,
          rowsFound: result.entries.length + result.errors.length,
          rowsInserted: imported,
          rowsDuplicate: result.entries.length - imported,
        })
        .where(ownedJob);
      return imported;
    });
    for (const path of [
      "/dashboard",
      "/transactions",
      "/accounts",
      "/budgets",
      "/reports",
      "/import",
    ])
      revalidatePath(path);
    return {
      imported: count,
      duplicates: result.entries.length - count,
    } as const;
  } catch {
    const error = "The statement could not be imported. Try again.";
    await db()
      .update(importJobs)
      .set({ status: "failed", error })
      .where(ownedJob);
    return { error } as const;
  }
}
