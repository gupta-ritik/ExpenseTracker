import Papa from "papaparse";
import { format, isValid, parse } from "date-fns";
import { rupeesToPaise } from "./money";

const labels = {
  date: ["date", "txn date", "transaction date", "tran date", "value date", "posting date"],
  description: ["description", "transaction remarks", "narration", "particulars", "transaction particulars", "remarks", "transaction description"],
  debit: ["debit", "debit amount", "withdrawal amt", "withdrawal amount", "withdrawals", "withdrawal", "dr amount"],
  credit: ["credit", "credit amount", "deposit amt", "deposit amount", "deposits", "deposit", "cr amount"],
  amount: ["amount", "transaction amount"],
  direction: ["dr cr", "cr dr", "debit credit", "type", "direction"],
};
const banks = {
  sbi: { date: ["txn date"], description: ["description"] },
  hdfc: { date: ["date"], description: ["narration"], debit: ["withdrawal amt"], credit: ["deposit amt"] },
  icici: { date: ["transaction date"], description: ["transaction remarks"], debit: ["withdrawal amount"], credit: ["deposit amount"] },
  axis: { date: ["tran date", "transaction date"], description: ["particulars"] },
  kotak: { date: ["transaction date", "date"], description: ["description", "particulars"] },
} satisfies Record<string, Partial<typeof labels>>;

export const bankPresets = ["sbi", "hdfc", "icici", "axis", "kotak", "generic"] as const;
export type BankPreset = typeof bankPresets[number];
type Field = keyof typeof labels;
export type CsvMapping = Partial<Record<Field, number>>;
export type ImportedEntry = {
  line: number;
  date: string;
  note: string;
  type: "income" | "expense";
  amountPaise: number;
};

function normalizeLabel(label: string) {
  return label.toLowerCase().replace(/\b(?:inr|rs)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function detectMapping(headers: string[], preset: BankPreset) {
  const normalized = headers.map(normalizeLabel);
  const preferred: Partial<typeof labels> = preset === "generic" ? {} : banks[preset];
  const mapping: CsvMapping = {};
  for (const field of Object.keys(labels) as Field[]) {
    const aliases = [...(preferred[field] ?? []), ...labels[field]];
    const matched = aliases.map(alias => normalized.indexOf(alias)).find(index => index >= 0);
    if (matched !== undefined) mapping[field] = matched;
  }
  return mapping;
}

export function prepareCsv(csv: string, preset: BankPreset) {
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  const rows = parsed.data;
  const preferredHeader = rows.findIndex((row, index) => {
    if (index > 25) return false;
    const mapping = detectMapping(row, preset);
    return mapping.date !== undefined && mapping.description !== undefined
      && (mapping.debit !== undefined || mapping.credit !== undefined || mapping.amount !== undefined);
  });
  const fallback = rows.findIndex(row => row.length >= 2);
  const header = preferredHeader >= 0 ? preferredHeader : Math.max(0, fallback);
  const columns = (rows[header] ?? []).map((cell, index) => cell.trim() || `Column ${index + 1}`);
  return { columns, rows: rows.slice(header + 1), mapping: detectMapping(columns, preset), firstLine: header + 2 };
}

function statementDate(input: string) {
  const clean = input.trim();
  for (const pattern of ["dd/MM/yyyy", "dd/MM/yy", "yyyy-MM-dd", "dd-MM-yyyy", "dd-MM-yy", "dd-MMM-yyyy", "dd MMM yyyy", "dd MMM yy"]) {
    const candidate = parse(clean, pattern, new Date(2020, 0, 1));
    if (isValid(candidate) && candidate.getFullYear() >= 1900) return format(candidate, "yyyy-MM-dd");
  }
  return null;
}

function statementAmount(input: string) {
  const clean = input.trim().replace(/^(?:\u20b9|INR|Rs\.?)\s*/i, "").replace(/\s*(?:CR|DR)\.?$/i, "");
  return !clean || clean === "-" ? 0 : rupeesToPaise(clean.replace(/^\((.+)\)$/, "-$1").replace(/^\+/, ""));
}

export function parseStatement(csv: string, preset: BankPreset, overrides?: CsvMapping) {
  const { columns, rows, mapping: automatic, firstLine } = prepareCsv(csv, preset);
  const mapping = overrides ?? automatic;
  const entries: ImportedEntry[] = [];
  const errors: { line: number; message: string }[] = [];
  if (mapping.date === undefined || mapping.description === undefined ||
      (mapping.amount === undefined && mapping.debit === undefined && mapping.credit === undefined)) {
    return { entries, errors, mapping, columns, mappingError: "Map a date, a description and at least one amount column." };
  }
  rows.forEach((row, index) => {
    const read = (field: Field) => {
      const column = mapping[field];
      return column === undefined ? "" : row[column] ?? "";
    };
    const date = statementDate(read("date"));
    const note = read("description").trim();
    const split = mapping.debit !== undefined || mapping.credit !== undefined;
    const debit = split ? statementAmount(read("debit")) : 0;
    const credit = split ? statementAmount(read("credit")) : 0;
    const signed = split ? 0 : statementAmount(read("amount"));
    const direction = `${read("direction")} ${read("amount").match(/\b(?:CR|DR)\.?$/i)?.[0] ?? ""}`.trim().toLowerCase();
    const income = split ? Boolean(credit) : /^cr|^credit/.test(direction) || (!/^dr|^debit/.test(direction) && (signed ?? 0) > 0);
    const amountPaise = Math.abs(split ? (income ? credit : debit) ?? 0 : signed ?? 0);
    const line = firstLine + index;
    if (!date || !note || !amountPaise || debit === null || credit === null || signed === null || (debit && credit)) {
      errors.push({ line, message: "Expected a date, description and one nonzero amount." });
      return;
    }
    entries.push({ line, date, note, amountPaise, type: income ? "income" : "expense" });
  });
  return { entries, errors, mapping, columns, mappingError: null };
}

export function importFingerprint(entry: Pick<ImportedEntry, "date" | "type" | "amountPaise" | "note">) {
  return JSON.stringify([
    entry.date, entry.type === "expense" ? -entry.amountPaise : entry.amountPaise,
    entry.note.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " "),
  ]);
}
