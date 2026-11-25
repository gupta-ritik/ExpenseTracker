import { format, isValid, parse } from "date-fns";
import type { Page } from "./extract";

export type CasTxnType =
  | "buy"
  | "sell"
  | "sip"
  | "switch_in"
  | "switch_out"
  | "dividend"
  | "bonus"
  | "split";
export type CasTxn = {
  date: string;
  type: CasTxnType;
  amountPaise: bigint;
  units: number;
  navPaise: bigint;
  description: string;
};
export type CasHolding = {
  kind: "mf" | "stock" | "bond" | "etf" | "other";
  isin: string;
  schemeCode?: string;
  name: string;
  folio?: string;
  units: number;
  costPaise?: bigint;
  pricePaise?: bigint;
  valuePaise?: bigint;
  asOf: string;
  openingUnits: number;
  txns: CasTxn[];
  needsReview: boolean;
};
export type Cas = {
  format: "cams" | "nsdl" | "cdsl";
  periodFrom?: string;
  periodTo?: string;
  holdings: CasHolding[];
  unparsedPages: number[];
};

const dateFormats = [
  "dd-MMM-yyyy",
  "d-MMM-yyyy",
  "dd/MM/yyyy",
  "dd-MM-yyyy",
  "d MMM yyyy",
];
function day(value: string | undefined) {
  if (!value) return undefined;
  for (const pattern of dateFormats) {
    const date = parse(value.trim(), pattern, new Date(2000, 0, 1));
    if (isValid(date) && date.getFullYear() > 1990)
      return format(date, "yyyy-MM-dd");
  }
  return undefined;
}
function num(value: string | undefined) {
  if (!value) return 0;
  const negative =
    /^\(.*\)$/.test(value.trim()) || value.trim().startsWith("-");
  const parsed = Number(value.replace(/[(),\s-]/g, ""));
  return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : 0;
}
/** Rupees with up to 4 decimals → paise as bigint, without floating-point drift. */
export function rupeesToPaiseBig(value: string | number) {
  const text =
    typeof value === "number"
      ? value.toFixed(4)
      : value.replace(/[(),\s]/g, "");
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return 0n;
  const [, sign, whole, fraction = ""] = match;
  const paise =
    BigInt(whole) * 100n +
    BigInt((fraction + "00").slice(0, 2)) +
    (Number(fraction[2] ?? 0) >= 5 ? 1n : 0n);
  return sign ? -paise : paise;
}

function txnType(description: string, units: number): CasTxnType {
  if (/switch[- ]?in/i.test(description)) return "switch_in";
  if (/switch[- ]?out/i.test(description)) return "switch_out";
  if (/dividend|idcw/i.test(description)) return "dividend";
  if (/bonus/i.test(description)) return "bonus";
  if (/split/i.test(description)) return "split";
  if (/redemption|redeem|sell|withdrawal/i.test(description) || units < 0)
    return "sell";
  if (/\bsip\b|systematic/i.test(description)) return "sip";
  return "buy";
}

const isin = /\b(IN[A-Z0-9]{9}\d)\b/;

/** CAMS / KFintech mutual fund CAS. Personal details are never read into the result. */
export function parseCams(pages: Page[]): Cas {
  const holdings: CasHolding[] = [];
  const lines = pages.flatMap((page) =>
    page.lines.map((line) => line.text.replace(/\s{2,}/g, "  ").trim()),
  );
  const period =
    /(\d{2}-[A-Za-z]{3}-\d{4})\s+To\s+(\d{2}-[A-Za-z]{3}-\d{4})/i.exec(
      lines.join("\n"),
    );
  let folio: string | undefined;
  let current: CasHolding | undefined;
  for (const line of lines) {
    const folioMatch =
      /^Folio No\s*:\s*([A-Z0-9/ ]+?)(?:\s{2,}|\s+PAN|\s+KYC|$)/i.exec(line);
    if (folioMatch) {
      folio = folioMatch[1].replace(/\s+/g, "");
      continue;
    }
    const scheme = isin.exec(line);
    if (scheme && /ISIN/i.test(line)) {
      const name = line
        .replace(/\s*-?\s*ISIN\s*:.*$/i, "")
        .replace(/^[A-Z0-9]+-/, "")
        .trim();
      current = {
        kind: /\bETF\b/i.test(name) ? "etf" : "mf",
        isin: scheme[1],
        name,
        folio,
        units: 0,
        asOf: "",
        openingUnits: 0,
        txns: [],
        needsReview: false,
      };
      holdings.push(current);
      continue;
    }
    if (!current) continue;
    const amfi = /AMFI(?:\s*Code)?\s*:\s*(\d{5,6})/i.exec(line);
    if (amfi) current.schemeCode = amfi[1];
    const opening = /Opening Unit Balance\s*:\s*([\d,.]+)/i.exec(line);
    if (opening) {
      current.openingUnits = num(opening[1]);
      continue;
    }
    const closing = /Closing Unit Balance\s*:\s*([\d,.]+)/i.exec(line);
    if (closing) {
      current.units = num(closing[1]);
      const nav = /NAV on\s+(\S+)\s*:\s*INR\s*([\d,.]+)/i.exec(line);
      const cost = /(?:Total\s+)?Cost Value\s*:\s*([\d,.]+)/i.exec(line);
      const value = /Market Value on\s+\S+\s*:\s*INR\s*([\d,.]+)/i.exec(line);
      current.asOf = day(nav?.[1]) ?? day(period?.[2]) ?? "";
      if (nav) current.pricePaise = rupeesToPaiseBig(nav[2].replace(/,/g, ""));
      if (cost) current.costPaise = rupeesToPaiseBig(cost[1].replace(/,/g, ""));
      if (value)
        current.valuePaise = rupeesToPaiseBig(value[1].replace(/,/g, ""));
      continue;
    }
    // date  description  amount  units  nav  unit-balance
    const txn =
      /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+(\(?-?[\d,]+\.\d{2}\)?)\s+(\(?-?[\d,]+\.\d{3,4}\)?)\s+([\d,]+\.\d{2,4})\s+([\d,]+\.\d{3,4})$/.exec(
        line,
      );
    if (txn) {
      const units = num(txn[4]);
      current.txns.push({
        date: day(txn[1])!,
        description: txn[2].slice(0, 120),
        type: txnType(txn[2], units),
        amountPaise: rupeesToPaiseBig(Math.abs(num(txn[3]))),
        units,
        navPaise: rupeesToPaiseBig(txn[5].replace(/,/g, "")),
      });
      continue;
    }
    const dividend =
      /^(\d{2}-[A-Za-z]{3}-\d{4})\s+((?:.*?)(?:Dividend|IDCW).*?)\s+([\d,]+\.\d{2})$/i.exec(
        line,
      );
    if (dividend)
      current.txns.push({
        date: day(dividend[1])!,
        description: dividend[2],
        type: "dividend",
        amountPaise: rupeesToPaiseBig(num(dividend[3])),
        units: 0,
        navPaise: 0n,
      });
  }
  for (const holding of holdings)
    holding.needsReview = !unitsReconcile(holding);
  return {
    format: "cams",
    periodFrom: day(period?.[1]),
    periodTo: day(period?.[2]),
    holdings,
    unparsedPages: [],
  };
}

/** Sum of transaction units must explain the closing balance (±0.001). */
export function unitsReconcile(
  holding: Pick<CasHolding, "openingUnits" | "units" | "txns">,
) {
  const moved = holding.txns.reduce((sum, txn) => sum + txn.units, 0);
  return Math.abs(holding.openingUnits + moved - holding.units) <= 0.001;
}

const sections: [RegExp, CasHolding["kind"]][] = [
  [/^Equit(?:y|ies)/i, "stock"],
  [/^(?:Exchange Traded Funds|ETFs?)\b/i, "etf"],
  [/^(?:Bonds|Debentures|Corporate Bonds|Government Securities)/i, "bond"],
  [/^Mutual Fund/i, "mf"],
  [/^Preference Shares|^Others?\b/i, "other"],
];

/** NSDL / CDSL e-CAS holdings: one row per ISIN with quantity, price and value. */
export function parseDepositoryCas(pages: Page[], kind: "nsdl" | "cdsl"): Cas {
  const holdings: CasHolding[] = [];
  const text = pages.map((page) => page.text).join("\n");
  const asOf =
    day(/(?:Holdings|Statement)\s+as\s+on\s+(\S+)/i.exec(text)?.[1]) ??
    day(/to\s+(\d{2}-[A-Za-z]{3}-\d{4})/i.exec(text)?.[1]) ??
    "";
  const period =
    /from\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+to\s+(\d{2}-[A-Za-z]{3}-\d{4})/i.exec(
      text,
    );
  const unparsedPages: number[] = [];
  for (const page of pages) {
    let section: CasHolding["kind"] | undefined;
    let found = 0;
    for (const line of page.lines) {
      const value = line.text.replace(/\s{2,}/g, "  ").trim();
      const heading = sections.find(([pattern]) => pattern.test(value));
      if (heading && !isin.test(value)) {
        section = heading[1];
        continue;
      }
      const row =
        /^(IN[A-Z0-9]{9}\d)\s+(.+?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+\.\d{2,4})\s+([\d,]+\.\d{2})$/.exec(
          value,
        );
      if (!row || !section) continue;
      found++;
      const units = num(row[3]);
      const valuePaise = rupeesToPaiseBig(row[5].replace(/,/g, ""));
      holdings.push({
        kind: section,
        isin: row[1],
        name: row[2].slice(0, 160),
        units,
        pricePaise: rupeesToPaiseBig(row[4].replace(/,/g, "")),
        valuePaise,
        asOf,
        openingUnits: units,
        txns: [],
        needsReview: false,
      });
    }
    if (!found && isin.test(page.text)) unparsedPages.push(page.number);
  }
  return {
    format: kind,
    periodFrom: day(period?.[1]),
    periodTo: day(period?.[2]) ?? asOf,
    holdings,
    unparsedPages,
  };
}

export function detectCas(text: string): Cas["format"] | null {
  if (/NSDL/i.test(text) && /Consolidated Account Statement/i.test(text))
    return "nsdl";
  if (/CDSL/i.test(text) && /Consolidated Account Statement/i.test(text))
    return "cdsl";
  if (/Consolidated Account Statement/i.test(text) && /Folio No/i.test(text))
    return "cams";
  if (/(?:CAMS|KFintech|Karvy)/i.test(text) && /Folio No/i.test(text))
    return "cams";
  return null;
}

export function parseCas(pages: Page[]): Cas | null {
  const kind = detectCas(pages.map((page) => page.text).join("\n"));
  if (!kind) return null;
  return kind === "cams" ? parseCams(pages) : parseDepositoryCas(pages, kind);
}
