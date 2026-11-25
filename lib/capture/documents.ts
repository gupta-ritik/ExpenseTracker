import {
  aiEnabled,
  casInstructions,
  casPageSchema,
  groqJson,
  statementInstructions,
  statementPageSchema,
} from "./groq";
import { finishJob, ingestRows, startJob, usageLogger } from "./ingest";
import { saveCas } from "./investments";
import { maskCaptureText } from "./mask";
import { rupeesToPaiseBig, parseCas, type Cas } from "./pdf/cas";
import {
  extractPages,
  PdfLimitError,
  PdfPasswordError,
  type Page,
} from "./pdf/extract";
import {
  detectLayout,
  parseStatement,
  reconcile,
  statementCaptureRows,
  type Reconciliation,
  type Statement,
} from "./pdf/statement";

export type DocumentKind = "statement" | "cas";
export type StatementPreview = {
  kind: "statement";
  bank: string;
  periodFrom?: string;
  periodTo?: string;
  reconciliation: Reconciliation;
  ai: boolean;
  rows: {
    date: string;
    note: string;
    type: "expense" | "income";
    amountPaise: number;
  }[];
};
export type CasPreview = {
  kind: "cas";
  format: Cas["format"];
  periodFrom?: string;
  periodTo?: string;
  ai: boolean;
  holdings: {
    name: string;
    isin: string;
    folio?: string;
    kind: string;
    units: number;
    valuePaise: number;
    needsReview: boolean;
  }[];
};
export type DocumentFailure = {
  error: string;
  status: "failed" | "needs_password" | "needs_ai_retry";
};

function toPaise(rupees: number | null | undefined) {
  return rupees === null || rupees === undefined
    ? undefined
    : Math.round(rupees * 100);
}

/** Groq fallback for unknown statement layouts: one masked page per call, large model. */
async function aiStatement(
  userId: string,
  pages: Page[],
  bank = "Bank",
): Promise<Statement | DocumentFailure> {
  const statement: Statement = { bank, rows: [], unparsedPages: [] };
  for (const page of pages) {
    const result = await groqJson({
      feature: "statement",
      instructions: statementInstructions,
      content: page.text,
      schema: statementPageSchema,
      large: true,
      log: usageLogger(userId),
    });
    if (!result.ok) {
      if (result.reason === "rate_limited" || result.reason === "timeout")
        return {
          status: "needs_ai_retry",
          error: "Groq is busy. Try this statement again in a minute.",
        };
      return {
        status: "failed",
        error: "This statement layout could not be read.",
      };
    }
    statement.openingPaise ??= toPaise(result.data.openingBalance);
    if (
      result.data.closingBalance !== null &&
      result.data.closingBalance !== undefined
    )
      statement.closingPaise = toPaise(result.data.closingBalance);
    for (const row of result.data.rows) {
      const debitPaise = toPaise(row.debit) ?? 0;
      const creditPaise = toPaise(row.credit) ?? 0;
      if (!debitPaise === !creditPaise) continue;
      statement.rows.push({
        date: row.date,
        description: maskCaptureText(row.description),
        debitPaise,
        creditPaise,
        balancePaise: toPaise(row.balance),
        refNo: row.refNo ?? undefined,
      });
    }
  }
  return statement;
}

async function aiCas(
  userId: string,
  pages: Page[],
  base?: Cas,
): Promise<Cas | DocumentFailure> {
  const cas: Cas = base ?? { format: "cams", holdings: [], unparsedPages: [] };
  for (const page of pages) {
    const result = await groqJson({
      feature: "cas",
      instructions: casInstructions,
      content: page.text,
      schema: casPageSchema,
      large: true,
      log: usageLogger(userId),
    });
    if (!result.ok) {
      if (result.reason === "rate_limited" || result.reason === "timeout")
        return {
          status: "needs_ai_retry",
          error: "Groq is busy. Try this CAS again in a minute.",
        };
      return { status: "failed", error: "This CAS layout could not be read." };
    }
    for (const item of result.data.holdings) {
      cas.holdings.push({
        kind: item.kind,
        isin: item.isin,
        name: item.name,
        folio: item.folio ?? undefined,
        units: item.units,
        pricePaise:
          item.price === null || item.price === undefined
            ? undefined
            : rupeesToPaiseBig(item.price),
        costPaise:
          item.cost === null || item.cost === undefined
            ? undefined
            : rupeesToPaiseBig(item.cost),
        asOf: cas.periodTo ?? "",
        openingUnits: item.units,
        txns: [],
        needsReview: true,
      });
    }
  }
  return cas;
}

async function readPdf(
  data: Uint8Array,
  password?: string,
): Promise<Page[] | DocumentFailure> {
  try {
    return await extractPages(data, password);
  } catch (error) {
    if (error instanceof PdfPasswordError)
      return { status: "needs_password", error: error.message };
    if (error instanceof PdfLimitError)
      return { status: "failed", error: error.message };
    return { status: "failed", error: "This PDF could not be read." };
  }
}

export function detectKind(pages: Page[]): DocumentKind | null {
  const text = pages.map((page) => page.text).join("\n");
  if (/Consolidated Account Statement|Folio No/i.test(text)) return "cas";
  if (
    detectLayout(text) ||
    /statement of account|account statement|opening balance/i.test(text)
  )
    return "statement";
  return null;
}

async function analyse(
  userId: string,
  data: Uint8Array,
  password: string | undefined,
  expected?: DocumentKind,
) {
  const pages = await readPdf(data, password);
  if ("error" in pages) return pages;
  const kind = expected ?? detectKind(pages);
  if (kind === "cas") {
    let cas = parseCas(pages);
    if (cas && cas.unparsedPages.length && aiEnabled()) {
      const extra = await aiCas(
        userId,
        pages.filter((page) => cas!.unparsedPages.includes(page.number)),
        cas,
      );
      if ("error" in extra) return extra;
      cas = extra;
    }
    if (!cas && aiEnabled()) {
      const extra = await aiCas(userId, pages);
      if ("error" in extra) return extra;
      cas = extra;
    }
    if (!cas || !cas.holdings.length)
      return {
        status: "failed",
        error: aiEnabled()
          ? "No holdings were found in this CAS."
          : "No holdings were found. AI parsing off: add GROQ_API_KEY to read other layouts.",
      } as DocumentFailure;
    return {
      kind: "cas" as const,
      cas,
      ai: cas.holdings.some(
        (item) => item.needsReview && !item.txns.length && !item.costPaise,
      ),
    };
  }
  if (kind !== "statement")
    return {
      status: "failed",
      error: "This PDF is not a bank statement or CAS.",
    } as DocumentFailure;
  let statement = parseStatement(pages);
  let ai = false;
  if ((!statement || !statement.rows.length) && aiEnabled()) {
    const extra = await aiStatement(userId, pages, statement?.bank);
    if ("error" in extra) return extra;
    statement = {
      ...extra,
      last4: statement?.last4,
      periodFrom: statement?.periodFrom,
      periodTo: statement?.periodTo,
      openingPaise: statement?.openingPaise ?? extra.openingPaise,
      closingPaise: statement?.closingPaise ?? extra.closingPaise,
    };
    ai = true;
  }
  if (!statement || !statement.rows.length)
    return {
      status: "failed",
      error: aiEnabled()
        ? "No transactions were found in this statement."
        : "Unknown statement layout. AI parsing off: add GROQ_API_KEY.",
    } as DocumentFailure;
  return {
    kind: "statement" as const,
    statement,
    ai,
    reconciliation: reconcile(statement),
  };
}

function reconciliationError(result: Reconciliation) {
  const rupees = (paise: number) => (paise / 100).toFixed(2);
  return `Reconciliation failed: opening ₹${rupees(result.openingPaise)} + credits ₹${rupees(result.creditsPaise)} − debits ₹${rupees(result.debitsPaise)} ≠ closing ₹${rupees(result.closingPaise)} (off by ₹${rupees(Math.abs(result.differencePaise))}). Nothing was imported.`;
}

/** Parses and validates a PDF without writing anything. */
export async function previewDocument(
  userId: string,
  data: Uint8Array,
  password?: string,
  expected?: DocumentKind,
): Promise<StatementPreview | CasPreview | DocumentFailure> {
  const result = await analyse(userId, data, password, expected);
  if ("error" in result) return result;
  if (result.kind === "cas") {
    return {
      kind: "cas",
      format: result.cas.format,
      periodFrom: result.cas.periodFrom,
      periodTo: result.cas.periodTo,
      ai: result.ai,
      holdings: result.cas.holdings.map((item) => ({
        name: item.name,
        isin: item.isin,
        folio: item.folio,
        kind: item.kind,
        units: item.units,
        valuePaise: Number(item.valuePaise ?? 0n),
        needsReview: item.needsReview,
      })),
    };
  }
  if (!result.reconciliation.ok)
    return {
      status: "failed",
      error: reconciliationError(result.reconciliation),
    };
  return {
    kind: "statement",
    bank: result.statement.bank,
    periodFrom: result.statement.periodFrom ?? result.statement.rows[0]?.date,
    periodTo: result.statement.periodTo ?? result.statement.rows.at(-1)?.date,
    reconciliation: result.reconciliation,
    ai: result.ai,
    rows: statementCaptureRows(result.statement).map((row) => ({
      date: row.date,
      note: row.note,
      type: row.type,
      amountPaise: row.amountPaise,
    })),
  };
}

/**
 * Imports a PDF statement or CAS. Every outcome writes an import job. A failed
 * reconciliation imports nothing.
 */
export async function importDocument(input: {
  userId: string;
  data: Uint8Array;
  password?: string;
  fileName?: string;
  accountId?: string;
  expected?: DocumentKind;
  mailConnectionId?: string;
  messageUid?: number;
}) {
  const result = await analyse(
    input.userId,
    input.data,
    input.password,
    input.expected,
  );
  const jobFields = {
    fileName: input.fileName?.slice(0, 200) ?? null,
    mailConnectionId: input.mailConnectionId ?? null,
    messageUid: input.messageUid ?? null,
  };
  if ("error" in result) {
    const jobId = await startJob(
      input.userId,
      input.expected === "cas" ? "cas" : "pdf",
      jobFields,
    );
    await finishJob(input.userId, jobId, {
      status: result.status,
      error: result.error,
    });
    return { ...result, jobId };
  }
  if (result.kind === "cas") {
    const jobId = await startJob(input.userId, "cas", {
      ...jobFields,
      periodFrom: result.cas.periodFrom ?? null,
      periodTo: result.cas.periodTo ?? null,
    });
    try {
      const saved = await saveCas(input.userId, result.cas);
      await finishJob(input.userId, jobId, {
        status: "done",
        rowsFound:
          result.cas.holdings.length +
          result.cas.holdings.reduce((sum, item) => sum + item.txns.length, 0),
        rowsInserted: saved.txnsInserted + saved.holdingsSaved,
        rowsDuplicate: saved.txnsDuplicate,
        rowsReview: saved.review,
      });
      return { kind: "cas" as const, jobId, ...saved };
    } catch (error) {
      await finishJob(input.userId, jobId, {
        status: "failed",
        error: "The holdings could not be saved.",
      });
      throw error;
    }
  }
  const period = {
    periodFrom:
      result.statement.periodFrom ?? result.statement.rows[0]?.date ?? null,
    periodTo:
      result.statement.periodTo ?? result.statement.rows.at(-1)?.date ?? null,
  };
  if (!result.reconciliation.ok) {
    const jobId = await startJob(input.userId, "pdf", {
      ...jobFields,
      ...period,
      rowsFound: result.statement.rows.length,
    });
    const error = reconciliationError(result.reconciliation);
    await finishJob(input.userId, jobId, { status: "failed", error });
    return { status: "failed" as const, error, jobId };
  }
  const rows = statementCaptureRows(result.statement).map((row) => ({
    ...row,
    confidence: result.ai ? 70 : 95,
  }));
  const saved = await ingestRows({
    userId: input.userId,
    source: "pdf",
    rows,
    accountId: input.accountId,
    job: { ...jobFields, ...period, rowsFound: rows.length },
  });
  return { kind: "statement" as const, ...saved };
}
