// Pure TypeScript: no Node-only imports, so the mobile app can reuse it.
import { format, isValid, parse } from "date-fns";
import { indiaToday } from "../expense/dates";
import { rupeesToPaise } from "../expense/money";

const month = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
export const captureDatePattern = new RegExp(
  `\\b(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-](?:\\d{4}|\\d{2})|\\d{1,2}[- ]?${month}[- ,]*(?:\\d{4}|\\d{2}))(?!\\d)`,
  "i",
);
export const captureAmountPattern =
  /(?:(?:₹|\bINR\b|\bRs\.?)\s*|\b(?:debited|credited)\s+(?:by|with|for)\s+)([+-]?\d[\d,]*(?:\.\d{1,2})?)(?![\d,]*\d)/i;
const dateFormats = [
  "yyyy-MM-dd",
  "d/M/yyyy",
  "d/M/yy",
  "d-M-yyyy",
  "d-M-yy",
  "d-MMM-yyyy",
  "d-MMM-yy",
  "d MMM yyyy",
  "d MMM yy",
  "dMMMyy",
  "dMMMyyyy",
  "d-MMMM-yyyy",
  "d MMMM yyyy",
  "d MMM, yyyy",
  "d MMMM, yyyy",
];
const cities =
  /\b(?:BANGALORE|BENGALURU|MUMBAI|CHENNAI|DELHI|NEW DELHI|NAVI MUMBAI|HYDERABAD|KOLKATA|GURUGRAM|GURGAON|NOIDA|PUNE)\s*$/i;

export function normalizeAmount(input: string) {
  return rupeesToPaise(
    input
      .trim()
      .replace(/^(?:₹|INR|Rs\.?)\s*/i, "")
      .replace(/\s*(?:DR|CR)$/i, "")
      .replace(/^\+/, ""),
  );
}

/** Calendar date as written in the message; the reference date resolves two-digit years. */
export function normalizeDate(
  input: string,
  receivedAt = new Date(),
): string | null {
  const match = input.match(captureDatePattern)?.[0];
  if (!match) return null;
  for (const pattern of dateFormats) {
    const date = parse(match, pattern, receivedAt);
    if (
      isValid(date) &&
      date.getFullYear() >= 1990 &&
      date.getFullYear() <= 2100
    ) {
      return format(date, "yyyy-MM-dd");
    }
  }
  return null;
}

/** Message date, else the day it was received in Asia/Kolkata. */
export function captureDate(input: string, receivedAt = new Date()) {
  return normalizeDate(input, receivedAt) ?? indiaToday(receivedAt);
}

export function normalizeMerchant(input: string) {
  return input
    .normalize("NFKC")
    .toUpperCase()
    .replace(
      /^(?:UPI|IMPS|NEFT|RTGS|POS|ATM)(?:[\s/:-]+(?:P2[AM]|CR|DR))?[\s/:-]+/i,
      "",
    )
    .replace(/@[A-Z\d][A-Z\d.-]*/g, "")
    .replace(
      /\b(?:REF(?:ERENCE)?(?:\s*(?:NO|NUMBER))?|UTR|RRN|TXN\s*ID)[\s:#.-]+[A-Z0-9-]+.*$/i,
      "",
    )
    .replace(/\b[A-Z]*\d{6,}[A-Z\d]*\b/g, "")
    .replace(
      /\b(?:A\s*\/?\s*C|ACCT|CARD)\s*(?:NO\.?)?\s*[*X•]*\s*(\d{4})\b/g,
      "A/C $1",
    )
    .replace(cities, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(cities, "")
    .trim()
    .slice(0, 120);
}

export function similarMerchant(a: string, b: string) {
  const left = normalizeMerchant(a);
  const right = normalizeMerchant(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const tokens = new Set(left.split(" "));
  const other = new Set(right.split(" "));
  const overlap = [...tokens].filter((token) => other.has(token)).length;
  if (overlap / Math.max(tokens.size, other.size) >= 0.75) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 4 && (" " + longer + " ").includes(" " + shorter + " "))
    return true;
  // A CSV narration usually wraps the merchant: every token of the alert merchant appears in it.
  const small = tokens.size <= other.size ? tokens : other;
  const large = tokens.size <= other.size ? other : tokens;
  return (
    small.size > 0 &&
    [...small].every((token) => token.length >= 3 && large.has(token))
  );
}
