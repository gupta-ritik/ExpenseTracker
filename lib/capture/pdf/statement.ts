import { format, isValid, parse } from "date-fns";
import { alertReference } from "../alerts";
import { lastFour, maskCaptureText, sanitizeMerchant } from "../mask";
import { normalizeAmount, normalizeMerchant } from "../normalize";
import type { Line, Page } from "./extract";

export type StatementRow = {
  date: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  balancePaise?: number;
  refNo?: string;
};
export type Statement = {
  bank: string;
  last4?: string;
  periodFrom?: string;
  periodTo?: string;
  openingPaise?: number;
  closingPaise?: number;
  rows: StatementRow[];
  /** Pages that had no recognisable table: candidates for the Groq fallback. */
  unparsedPages: number[];
};
export type Reconciliation = {
  ok: boolean;
  openingPaise: number;
  closingPaise: number;
  creditsPaise: number;
  debitsPaise: number;
  differencePaise: number;
};

type Column =
  | "date"
  | "description"
  | "ref"
  | "debit"
  | "credit"
  | "balance"
  | "skip";
type Layout = {
  bank: string;
  detect: RegExp;
  dateFormats: string[];
  headers: [Column, RegExp][];
};

/** Deterministic layouts. Header text decides the column x positions on every page. */
export const layouts: Layout[] = [
  {
    bank: "SBI",
    detect: /STATE BANK OF INDIA|\bSBI\b/i,
    dateFormats: ["d MMM yyyy", "d-MMM-yyyy", "dd/MM/yyyy"],
    headers: [
      ["date", /^Txn Date$/i],
      ["skip", /^Value Date$/i],
      ["description", /^Description$/i],
      ["ref", /^Ref No\.?\/?Cheque No\.?$/i],
      ["debit", /^Debit$/i],
      ["credit", /^Credit$/i],
      ["balance", /^Balance$/i],
    ],
  },
  {
    bank: "HDFC",
    detect: /HDFC BANK/i,
    dateFormats: ["dd/MM/yy", "dd/MM/yyyy"],
    headers: [
      ["date", /^Date$/i],
      ["description", /^Narration$/i],
      ["ref", /^Chq\.?\/?Ref\.?No\.?$/i],
      ["skip", /^Value Dt$/i],
      ["debit", /^Withdrawal Amt\.?$/i],
      ["credit", /^Deposit Amt\.?$/i],
      ["balance", /^Closing Balance$/i],
    ],
  },
  {
    bank: "ICICI",
    detect: /ICICI BANK/i,
    dateFormats: ["dd/MM/yyyy", "dd-MM-yyyy"],
    headers: [
      ["skip", /^S ?No\.?$/i],
      ["skip", /^Value Date$/i],
      ["date", /^Transaction Date$/i],
      ["ref", /^Cheque Number$/i],
      ["description", /^Transaction Remarks$/i],
      ["debit", /^Withdrawal Amount/i],
      ["credit", /^Deposit Amount/i],
      ["balance", /^Balance/i],
    ],
  },
  {
    bank: "Axis",
    detect: /AXIS BANK/i,
    dateFormats: ["dd-MM-yyyy", "dd/MM/yyyy"],
    headers: [
      ["date", /^Tran Date$/i],
      ["ref", /^Chq No$/i],
      ["description", /^Particulars$/i],
      ["debit", /^Debit$/i],
      ["credit", /^Credit$/i],
      ["balance", /^Balance$/i],
      ["skip", /^Init\.? ?Br$/i],
    ],
  },
  {
    bank: "Kotak",
    detect: /KOTAK MAHINDRA BANK/i,
    dateFormats: ["dd-MM-yyyy", "dd/MM/yyyy"],
    headers: [
      ["date", /^Date$/i],
      ["description", /^Narration$/i],
      ["ref", /^Chq\/Ref No\.?$/i],
      ["debit", /^Withdrawal \(Dr\)$/i],
      ["credit", /^Deposit \(Cr\)$/i],
      ["balance", /^Balance$/i],
    ],
  },
];

const amount = /^-?[\d,]+\.\d{2}(?:\s*(?:Cr|Dr))?$/i;

function parseDate(value: string, formats: string[]) {
  for (const pattern of formats) {
    const date = parse(value.trim(), pattern, new Date(2000, 0, 1));
    if (isValid(date) && date.getFullYear() > 1990)
      return format(date, "yyyy-MM-dd");
  }
  return null;
}

function money(value: string | undefined) {
  if (!value) return undefined;
  const signed = /dr$/i.test(value.trim()) ? -1 : 1;
  const paise = normalizeAmount(value.replace(/\s*(?:Cr|Dr)$/i, ""));
  return paise === null ? undefined : paise * signed;
}

function summaryAmount(text: string, label: RegExp) {
  const match = new RegExp(
    `${label.source}[^\\d-]{0,30}(-?[\\d,]+\\.\\d{2})`,
    "i",
  ).exec(text);
  return money(match?.[1]);
}

function headerColumns(line: Line, layout: Layout) {
  const columns: { column: Column; x: number }[] = [];
  for (const cell of line.cells) {
    const found = layout.headers.find(([, pattern]) => pattern.test(cell.text));
    if (found) columns.push({ column: found[0], x: cell.x });
  }
  return columns.some((item) => item.column === "date") &&
    columns.some((item) => item.column === "balance")
    ? columns
    : null;
}

/** Assigns a cell to the header whose start position is nearest on its left. */
function columnFor(x: number, columns: { column: Column; x: number }[]) {
  let best = columns[0];
  for (const column of columns)
    if (column.x <= x + 4 && column.x >= best.x) best = column;
  return best.column;
}

export function detectLayout(text: string) {
  return layouts.find((layout) => layout.detect.test(text));
}

/** Rebuilds statement rows from text positions using the bank's header layout. */
export function parseStatement(pages: Page[]): Statement | null {
  const all = pages.map((page) => page.text).join("\n");
  const layout = detectLayout(all);
  if (!layout) return null;
  const rows: StatementRow[] = [];
  const unparsedPages: number[] = [];
  for (const page of pages) {
    let columns: { column: Column; x: number }[] | null = null;
    let found = 0;
    for (const line of page.lines) {
      const header = headerColumns(line, layout);
      if (header) {
        columns = header;
        continue;
      }
      if (!columns) continue;
      if (
        /^(?:opening|closing)\s+balance|^statement summary|^page \d/i.test(
          line.text,
        )
      ) {
        columns = null;
        continue;
      }
      const cells: Partial<Record<Column, string>> = {};
      for (const cell of line.cells) {
        const column = columnFor(cell.x, columns);
        cells[column] = cells[column]
          ? `${cells[column]} ${cell.text}`
          : cell.text;
      }
      const date = cells.date
        ? parseDate(cells.date, layout.dateFormats)
        : null;
      if (!date) {
        // A wrapped narration line continues the previous row.
        const previous = rows.at(-1);
        if (previous && cells.description && !cells.balance && found)
          previous.description += " " + cells.description;
        continue;
      }
      const debit =
        cells.debit && amount.test(cells.debit) ? (money(cells.debit) ?? 0) : 0;
      const credit =
        cells.credit && amount.test(cells.credit)
          ? (money(cells.credit) ?? 0)
          : 0;
      if (!debit && !credit) continue;
      found++;
      rows.push({
        date,
        description: cells.description ?? "",
        debitPaise: Math.abs(debit),
        creditPaise: Math.abs(credit),
        balancePaise: money(cells.balance),
        refNo:
          cells.ref && /\d/.test(cells.ref)
            ? cells.ref.toUpperCase()
            : undefined,
      });
    }
    if (!found && /\d+\.\d{2}/.test(page.text) && !headerOnly(page))
      unparsedPages.push(page.number);
  }
  const masked = maskCaptureText(all);
  const account =
    /(?:Account\s*(?:No\.?|Number)|A\/c\s*No\.?)\s*[:#-]?\s*(\*{2,}\d{4}|[X*•\d ]{6,24}\d{4})/i.exec(
      masked,
    )?.[1];
  const period =
    /(?:from|period)\s*:?\s*(\S+(?:\s\S+){0,2}?)\s+to\s*:?\s*(\S+(?:\s\S+){0,2})/i.exec(
      all,
    );
  return {
    bank: layout.bank,
    last4: account ? lastFour(account) : undefined,
    rows,
    unparsedPages,
    periodFrom: periodDate(period?.[1], layout),
    periodTo: periodDate(period?.[2], layout),
    openingPaise: summaryAmount(all, /opening\s+balance/),
    closingPaise: summaryAmount(all, /closing\s+balance/),
  };
}

/** A period capture may run into the next words: try three, two, then one token. */
function periodDate(value: string | undefined, layout: Layout) {
  if (!value) return undefined;
  const tokens = value.trim().split(/\s+/);
  for (let count = Math.min(3, tokens.length); count > 0; count--) {
    const found = parseDate(tokens.slice(0, count).join(" "), [
      ...layout.dateFormats,
      "dd-MM-yyyy",
      "dd/MM/yyyy",
      "d MMM yyyy",
    ]);
    if (found) return found;
  }
  return undefined;
}

function headerOnly(page: Page) {
  return page.lines.length < 4;
}

/**
 * opening + credits − debits must equal closing within ₹1. Missing summary
 * balances are derived from the first and last running balances.
 */
export function reconcile(
  statement: Pick<Statement, "rows" | "openingPaise" | "closingPaise">,
): Reconciliation {
  const creditsPaise = statement.rows.reduce(
    (sum, row) => sum + row.creditPaise,
    0,
  );
  const debitsPaise = statement.rows.reduce(
    (sum, row) => sum + row.debitPaise,
    0,
  );
  const first = statement.rows[0];
  const last = statement.rows.at(-1);
  const openingPaise =
    statement.openingPaise ??
    (first?.balancePaise !== undefined
      ? first.balancePaise - first.creditPaise + first.debitPaise
      : 0);
  const closingPaise =
    statement.closingPaise ?? last?.balancePaise ?? openingPaise;
  const differencePaise =
    openingPaise + creditsPaise - debitsPaise - closingPaise;
  return {
    ok: statement.rows.length > 0 && Math.abs(differencePaise) <= 100,
    openingPaise,
    closingPaise,
    creditsPaise,
    debitsPaise,
    differencePaise,
  };
}

/** Converts statement rows to masked capture rows. Narrations are masked before they leave this module. */
export function statementCaptureRows(statement: Statement) {
  return statement.rows.map((row) => {
    const narration = sanitizeMerchant(row.description);
    return {
      type: row.creditPaise > 0 ? ("income" as const) : ("expense" as const),
      amountPaise: row.creditPaise || row.debitPaise,
      date: row.date,
      merchant: normalizeMerchant(narration).slice(0, 80),
      note: narration.slice(0, 300),
      refNo:
        alertReference(row.description) ??
        (/\b(?:UPI|IMPS)\b/i.test(row.description)
          ? /(?<!\d)(\d{12})(?!\d)/.exec(row.description)?.[1]
          : undefined) ??
        (row.refNo &&
        /^[A-Z0-9-]{6,32}$/.test(row.refNo) &&
        !/^0+$/.test(row.refNo)
          ? row.refNo.replace(/^0+(?=\d{6})/, "")
          : undefined),
      confidence: 95,
      last4: statement.last4,
      bankName: statement.bank,
    };
  });
}
