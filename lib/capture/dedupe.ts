import { createHash } from "node:crypto";
import { addDays, format, parseISO } from "date-fns";
import { and, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { db } from "../db";
import { accounts, transactions } from "../db/schema";
import { normalizeMerchant, similarMerchant } from "./normalize";

export type DedupeRow = {
  type: "expense" | "income";
  amountPaise: number;
  date: string;
  merchant: string;
  last4?: string | null;
  refNo?: string | null;
};

export type ExistingRow = DedupeRow & {
  id: string;
  note: string;
  confidence: number;
};

/** The capture fingerprint, in the same JSON style as the CSV importFingerprint. */
export function captureFingerprint(userId: string, row: DedupeRow) {
  return [
    userId,
    row.last4 ?? "",
    row.amountPaise,
    row.type,
    row.date,
    (row.refNo ?? "").toUpperCase(),
    normalizeMerchant(row.merchant),
  ].join("|");
}

export function captureHash(userId: string, row: DedupeRow) {
  return createHash("sha256")
    .update(captureFingerprint(userId, row))
    .digest("hex");
}

function dayGap(a: string, b: string) {
  return Math.abs(parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000;
}

/**
 * Rule 1: same reference → duplicate (a reference inside a CSV narration counts).
 * Rule 2: same last4, amount, type, date ±1 day and a similar merchant.
 */
export function isDuplicate(row: DedupeRow, existing: ExistingRow) {
  const ref = row.refNo?.toUpperCase();
  const otherRef = existing.refNo?.toUpperCase();
  if (ref && otherRef) return sameReference(ref, otherRef);
  if (ref && ref.length >= 6 && existing.note.toUpperCase().includes(ref))
    return true;
  if (
    otherRef &&
    otherRef.length >= 6 &&
    normalizeMerchant(row.merchant).includes(otherRef)
  )
    return true;
  if (row.amountPaise !== existing.amountPaise || row.type !== existing.type)
    return false;
  if (dayGap(row.date, existing.date) > 1) return false;
  const bothCards = Boolean(row.last4 && existing.last4);
  if (bothCards && row.last4 !== existing.last4) return false;
  const left = row.merchant;
  const right = existing.merchant || existing.note;
  if (!normalizeMerchant(left) || !normalizeMerchant(right)) return bothCards;
  return similarMerchant(left, right);
}

type Executor = Pick<ReturnType<typeof db>, "select">;

/** Loads every live transaction that could be a duplicate of any row, across all sources. */
export async function duplicateCandidates(
  executor: Executor,
  userId: string,
  rows: DedupeRow[],
): Promise<ExistingRow[]> {
  if (!rows.length) return [];
  const dates = rows.map((row) => row.date).sort();
  const from = format(addDays(parseISO(dates[0]), -1), "yyyy-MM-dd");
  const to = format(addDays(parseISO(dates.at(-1)!), 1), "yyyy-MM-dd");
  const refs = [
    ...new Set(
      rows.flatMap((row) => (row.refNo ? [row.refNo.toUpperCase()] : [])),
    ),
  ];
  const found = await executor
    .select({
      id: transactions.id,
      type: transactions.type,
      amountPaise: transactions.amountPaise,
      date: transactions.date,
      merchant: transactions.merchant,
      note: transactions.note,
      refNo: transactions.refNo,
      confidence: transactions.confidence,
      last4: accounts.last4,
    })
    .from(transactions)
    .leftJoin(
      accounts,
      and(eq(accounts.userId, userId), eq(accounts.id, transactions.accountId)),
    )
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        or(
          and(
            gte(transactions.date, from),
            lte(transactions.date, to),
            inArray(transactions.amountPaise, [
              ...new Set(rows.map((row) => row.amountPaise)),
            ]),
          ),
          refs.length ? inArray(transactions.refNo, refs) : undefined,
        ),
      ),
    );
  return found.flatMap((row) =>
    row.type === "transfer" ? [] : [{ ...row, type: row.type }],
  );
}

/** Banks pad or prefix the same reference differently (0000433112345678 vs 433112345678). */
export function sameReference(a: string, b: string) {
  const left = a
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+/, "");
  const right = b
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+/, "");
  if (left === right) return true;
  const [short, long] =
    left.length <= right.length ? [left, right] : [right, left];
  return short.length >= 10 && long.endsWith(short);
}
