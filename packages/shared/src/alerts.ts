// Pure TypeScript: no Node-only imports, so the mobile app can reuse it.
import {
  captureAmountPattern,
  captureDate,
  normalizeAmount,
  normalizeMerchant,
} from "./normalize";
import { lastFour, maskCaptureText, sanitizeMerchant } from "./mask";

export const bankSenders = [
  "HDFCBK",
  "HDFCBN",
  "SBIINB",
  "SBIPSG",
  "SBIUPI",
  "ATMSBI",
  "CBSSBI",
  "SBICRD",
  "ICICIB",
  "ICICIT",
  "AXISBK",
  "AXISCC",
  "KOTAKB",
  "KOTAKM",
  "GPAY",
  "GOOGLEPAY",
  "PHONEPE",
  "PAYTM",
  "PYTMBK",
] as const;
export const bankEmailSenders = [
  "alerts@hdfcbank.net",
  "alerts@hdfcbank.bank.in",
  "donotreply.sbiatm@alerts.sbi.co.in",
  "cbssbi.cas@alerts.sbi.co.in",
  "credit_cards@icicibank.com",
  "customernotification@icicibank.com",
  "alerts@axisbank.com",
  "bankalerts@kotak.com",
  "donotreply@camsonline.com",
  "eCAS@nsdl.co.in",
  "ecas@cdslstatement.com",
] as const;

export type CaptureRow = {
  type: "expense" | "income";
  amountPaise: number;
  date: string;
  merchant: string;
  confidence: number;
  last4?: string;
  bankName?: string;
  refNo?: string;
  balancePaise?: number;
  instrument?: "card" | "account";
};
export type AlertResult =
  | { kind: "parsed"; row: CaptureRow }
  | { kind: "ignored"; reason: string }
  | { kind: "unknown" };

const banks = [
  ["SBI", /\b(?:SBI(?:INB|PSG|UPI|CRD)?|STATE BANK OF INDIA)\b/i],
  ["HDFC", /\bHDFC(?:BK|BN| BANK)?\b/i],
  ["ICICI", /\bICICI(?:B|T| BANK)?\b/i],
  ["Axis", /\bAXIS(?:BK|CC| BANK)?\b/i],
  ["Kotak", /\bKOTAK(?:B|M| MAHINDRA| BANK)?\b/i],
  ["Google Pay", /\b(?:GPAY|GOOGLE\s?PAY)\b/i],
  ["PhonePe", /\bPHONEPE\b/i],
  ["Paytm", /\bPAYTM|PYTMBK\b/i],
] as const;
const credit =
  /\b(?:credited|received|deposited|refunded|reversed|credit(?:ed)?(?:\s+of)?)\b/i;
const debit =
  /\b(?:debited|debit(?:\s+of)?|spent|charged|paid|sent|withdrawn|withdrawal|deducted|purchased|transferred)\b/i;
const references = [
  /\b(?:UTR|RRN|(?:UPI\s+)?REF(?:ERENCE)?|TXN\.?|TRXN\.?|TRANSACTION)\.?\s*(?:NO\.?|NUMBER|ID)?(?:\s+IS)?[\s:#.-]+([A-Z0-9][A-Z0-9-]{5,31})\b/gi,
  /\bUPI[:/-]\s*(?:P2[AM]\/)?(\d{12})\b/i,
  /\b(?:NEFT|IMPS|RTGS)[/-](?:CR-|DR-)?([A-Z]{4}[A-Z0-9]{8,18})\b/i,
];
const account =
  /\b(?:A\s*\/?\s*C|ACCT|ACCOUNT|CARD)(?:\s*(?:NO\.?|NUMBER|ENDING(?:\s+IN)?))?[\s:#-]*((?:[Xx*•]+\s*)?\d(?:[\d -]{2,19}\d)?)\b/i;
const stop =
  /(?:\s+(?:on\s+\d|on\s+20\d\d|from\s+(?:\w+\s+)?(?:bank\s+)?a\/?c|using\s|via\s|(?:upi\s+)?ref(?:no|erence)?[ .:#]|utr[ .:#]|rrn[ .:#]|txn\.?\s+id|available\s+bal|avl\.?\s+(?:bal|lmt|limit)|updated\s+bal|balance|if\s+not\s+you|not\s+you|(?:in|to)\s+your\b|from\s+(?:\w+\s+){0,2}(?:upi|wallet|a\/?c|bank)\b)|\s*\(|\.\s+[A-Z]|\.?\s*UPI[:/]|[\r\n;]|\.$)/i;

/**
 * Help text banks append ("To dispute call …", "SMS BLOCK 1234 to …"). It holds
 * words like "to" that the merchant extractor would otherwise read as a payee.
 */
const helpFooter =
  /(?:^|[\s.;,/])(?:to\s+dispute|for\s+dispute|to\s+report|sms\s+block|call\s+(?:\[PHONE\]|\d[\d\s-]{5,}))\b[\s\S]*$/i;

/** Bank-specific merchant templates, tried before the generic extractor. */
const templates: {
  bank?: string;
  pattern: RegExp;
  merchant: number;
  ref?: number;
}[] = [
  {
    bank: "Axis",
    pattern: /UPI\/P2[AM]\/(\d{12})\/([^\n/]+)/i,
    merchant: 2,
    ref: 1,
  },
  {
    bank: "Axis",
    pattern:
      /\d{2}-\d{2}-\d{2},?\s+[\d:]+(?:\s*IST)?\s*\n\s*(?!UPI\/)([A-Z][^\n]{1,60})\n/i,
    merchant: 1,
  },
  { bank: "ICICI", pattern: /;\s*([^;.]+?)\s+credited\b/i, merchant: 1 },
  {
    bank: "HDFC",
    pattern: /NEFT\s+Cr-[A-Z]{4}0[A-Z0-9]{6}-([^-]+)-([^-.]*)/i,
    merchant: 1,
  },
  {
    pattern:
      /\bon\s+\d{1,2}[-/ ](?:\d{1,2}|[A-Za-z]{3})[-/ ]\d{2,4}\s+(?:on|at)\s+([A-Z][^.\n]+)/i,
    merchant: 1,
  },
];

export function isSenderAllowed(
  sender: string,
  allowlist: readonly string[] = bankSenders,
) {
  const component = sender
    .trim()
    .toUpperCase()
    .replace(/^[A-Z0-9]{2}-/, "")
    .replace(/-[A-Z]$/, "");
  return allowlist.some(
    (item) => item.toUpperCase().replace(/^\*-/, "") === component,
  );
}

export function ignoredAlert(text: string) {
  if (
    /\b(?:otp|one[- ]time (?:password|code)|verification code|security code)\b|\[CODE\]/i.test(
      text,
    )
  )
    return "Verification code";
  if (
    /\b(?:failed|declined|unsuccessful|expired|attempted|rejected|not debited|could not be processed)\b/i.test(
      text,
    )
  )
    return "Unsuccessful transaction";
  if (
    /\b(?:payment\s+(?:of\s+.{0,30}\s+)?(?:is\s+)?due|amount\s+due|minimum\s+due|total\s+due|pay\s+by|statement\s+(?:for\s+.{0,20}\s+)?(?:is\s+)?(?:ready|available|generated)|due\s+(?:date|on))\b/i.test(
      text,
    )
  )
    return "Reminder";
  if (
    /\b(?:offer|pre[- ]approved|apply now|exclusive deal|cashback offer|win up to|shop now|get up to|upgrade now)\b/i.test(
      text,
    )
  )
    return "Promotion";
  if (
    /\b(?:available|closing|current|account|avl)\s+bal(?:ance)?\b/i.test(
      text,
    ) &&
    !credit.test(text) &&
    !debit.test(text)
  )
    return "Balance only";
  return null;
}

export function alertReference(text: string) {
  for (const pattern of references) {
    const matches = pattern.global
      ? [...text.matchAll(pattern)]
      : [pattern.exec(text)];
    const found = matches
      .map((match) => match?.[1]?.toUpperCase())
      .find((value) => value && /\d/.test(value));
    if (found) return found;
  }
  return undefined;
}

function genericMerchant(context: string, type: CaptureRow["type"]) {
  const named = /\b(?:AT|INFO|MERCHANT|VPA)[\s:#/-]+(?!\d)(.+)/i.exec(
    context,
  )?.[1];
  const direction =
    type === "income"
      ? (/\bFROM\s+(?!rs\b|inr\b)(.+)/i.exec(context) ??
          /\bBY\s+(?!rs\b|inr\b|transfer\b)(.+)/i.exec(context))?.[1]
      : /\b(?:TO|TOWARDS)\s+(.+)/i.exec(context)?.[1];
  return named ?? direction ?? "";
}

/**
 * Parses one bank alert. The text is masked first, so nothing returned can carry
 * a full account number, PAN, phone number or code.
 */
export function parseAlert(
  raw: string,
  sender = "",
  receivedAt = new Date(),
): AlertResult {
  const text = maskCaptureText(raw);
  const ignored = ignoredAlert(text);
  if (ignored) return { kind: "ignored", reason: ignored };
  const bank =
    banks.find(([, expression]) => expression.test(text))?.[0] ??
    banks.find(([, expression]) => expression.test(sender))?.[0];
  const amountText = text.match(captureAmountPattern);
  const amount = amountText && normalizeAmount(amountText[1]);
  const debitMatch = debit.exec(text);
  const creditMatch = credit.exec(text);
  if (!bank || !amount || (!debitMatch && !creditMatch))
    return { kind: "unknown" };
  const position = amountText.index ?? 0;
  const type: CaptureRow["type"] =
    creditMatch &&
    (!debitMatch ||
      Math.abs(creditMatch.index - position) <
        Math.abs(debitMatch.index - position))
      ? "income"
      : "expense";
  // Look for the merchant only in the transaction part, never in the help footer.
  const body = text.replace(helpFooter, "");
  const template = templates
    .map((item) => ({
      item,
      found: !item.bank || item.bank === bank ? item.pattern.exec(body) : null,
    }))
    .find((entry) => entry.found);
  const context = body.slice(position + amountText[0].length);
  const candidate =
    template?.found?.[template.item.merchant] ?? genericMerchant(context, type);
  const cleaned = candidate.split(stop)[0];
  const merchant = normalizeMerchant(
    sanitizeMerchant(cleaned.replace(/@[a-z0-9.-]+\b/gi, "")),
  );
  const balance =
    /\b(?:AV(?:L|AIL(?:ABLE)?)\.?\s+BAL(?:ANCE)?|UPDATED\s+BALANCE|BAL)\s*(?:IS)?\s*[:=-]?\s*(?:INR|RS\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i.exec(
      text,
    )?.[1];
  const templateRef = template?.item.ref
    ? template.found?.[template.item.ref]
    : undefined;
  const row: CaptureRow = {
    type,
    amountPaise: Math.abs(amount),
    date: captureDate(text, receivedAt),
    merchant,
    confidence: 95,
    bankName: bank,
    last4: lastFour(account.exec(text)?.[1] ?? ""),
    refNo: templateRef ?? alertReference(text),
    balancePaise: balance ? (normalizeAmount(balance) ?? undefined) : undefined,
    instrument: /\b(?:credit|debit)?\s*card\b/i.test(text) ? "card" : "account",
  };
  return { kind: "parsed", row };
}

/**
 * Splits pasted text into messages. Blank lines or "---" separate messages; without
 * them, each line is a message only when every line carries its own amount.
 */
export function splitMessages(text: string) {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return [];
  const blocks = trimmed
    .split(/\n\s*\n|\n-{3,}\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;
  const lines = trimmed
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  return lines.length > 1 &&
    lines.every((line) => captureAmountPattern.test(line))
    ? lines
    : [trimmed];
}
