// Pure TypeScript: no Node-only imports, so the mobile app can reuse it.
const accountLabel =
  /\b((?:a\s*\/?\s*c|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s+in)?))?[\s:#-]*)([Xx*•]*\d[\d Xx*•-]{2,26}\d)\b/gi;
const pan = /\b[A-Z]{5}\d{4}[A-Z]\b/gi;
const aadhaar = /(?<![\w\d])(?:\d{4}[- ]?\d{4}[- ]?\d{4})(?!\d)/g;
const email = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Z]{2,}\b/gi;
const mobile = /(?<![\w\d])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
const longDigits = /(?<![\w\d])(?:\d[ -]?){13,18}\d(?!\d)/g;
const maskedAccount = /\b(?:x{2,}|[•*]{2,})\s*(\d{4})(?!\d)/gi;
const referenceLabel =
  /(?:\b(?:ref(?:erence)?|refno|utr|rrn|txn|trxn|transaction)\.?(?:\s*(?:no\.?|number|id))?(?:\s+is)?[\s:#.-]*|\bUPI[/:-]\s*(?:P2[AM]\/)?|\bIMPS[/:-]\s*)$/i;

export function lastFour(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

/** Leaves numbers that are explicitly labelled as payment references untouched. */
function unlessReference(replacement: string) {
  return (match: string, ...args: unknown[]) => {
    const whole = args.at(-1) as string;
    const offset = args.at(-2) as number;
    return referenceLabel.test(whole.slice(Math.max(0, offset - 28), offset))
      ? match
      : replacement;
  };
}

export function maskCaptureText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/(?:[​-‏‪-‮⁠-⁯﻿])/g, "")
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966))
    .replace(
      /(?:\b(?:otp|one[- ]time (?:password|code)|verification code|security code)\b(?:\s+is)?[\s:=-]*)\d(?:[\s-]?\d){3,9}\b/gi,
      "[CODE]",
    )
    .replace(
      /\b\d(?:[\s-]?\d){3,9}\b(?=\s+(?:is\s+)?(?:your\s+)?(?:otp|verification code|one[- ]time password)\b)/gi,
      "[CODE]",
    )
    .replace(
      /^\s*(?:investor(?:\s+name)?|holder(?:\s+name)?|customer(?:\s+name)?|name|address|communication address)\s*:\s*.*$/gim,
      "[PERSONAL DETAILS]",
    )
    .replace(accountLabel, (raw, label: string, id: string) => {
      const digits = id.replace(/\D/g, "");
      return digits.length === 4 || digits.length >= 8
        ? label + "****" + digits.slice(-4)
        : raw;
    })
    .replace(/\b\d{4,6}[Xx*•]{2,10}(\d{4})\b/g, "****$1")
    .replace(pan, "[PAN]")
    .replace(email, "[EMAIL]")
    .replace(aadhaar, unlessReference("[ID]"))
    .replace(mobile, unlessReference("[PHONE]"))
    .replace(longDigits, unlessReference("[NUMBER]"))
    .replace(maskedAccount, "****$1");
}

export function sanitizeMerchant(value: string) {
  return maskCaptureText(value)
    .replace(/\[(?:PAN|EMAIL|ID|PHONE|NUMBER|CODE|PERSONAL DETAILS)\]/g, "")
    .trim();
}
