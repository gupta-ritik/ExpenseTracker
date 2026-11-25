import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPages, PdfPasswordError } from "../../lib/capture/pdf/extract";
import {
  parseStatement,
  reconcile,
  statementCaptureRows,
} from "../../lib/capture/pdf/statement";
import {
  parseCas,
  rupeesToPaiseBig,
  unitsReconcile,
} from "../../lib/capture/pdf/cas";
import { xirr } from "../../lib/capture/xirr";

const pdf = (name: string) =>
  new Uint8Array(readFileSync(`tests/fixtures/${name}`));

describe("bank statement PDFs", () => {
  it("asks for a password and rejects a wrong one", async () => {
    await expect(extractPages(pdf("pdf/hdfc.pdf"))).rejects.toMatchObject({
      name: "PdfPasswordError",
      incorrect: false,
    });
    await expect(
      extractPages(pdf("pdf/hdfc.pdf"), "wrong"),
    ).rejects.toBeInstanceOf(PdfPasswordError);
  });

  it("parses the password-protected HDFC statement and reconciles", async () => {
    const statement = parseStatement(
      await extractPages(pdf("pdf/hdfc.pdf"), "TEST1234"),
    )!;
    expect(statement.bank).toBe("HDFC");
    expect(statement.last4).toBe("1234");
    expect(statement.periodFrom).toBe("2026-11-01");
    expect(statement.periodTo).toBe("2026-11-30");
    expect(statement.rows).toHaveLength(5);
    expect(statement.rows[3]).toMatchObject({
      date: "2026-11-25",
      debitPaise: 49_900,
      creditPaise: 0,
    });
    expect(reconcile(statement)).toMatchObject({
      ok: true,
      openingPaise: 1_000_000,
      closingPaise: 6_400_100,
      differencePaise: 0,
    });
    const rows = statementCaptureRows(statement);
    expect(rows[3]).toMatchObject({
      type: "expense",
      amountPaise: 49_900,
      refNo: "433112345678",
      last4: "1234",
    });
    expect(JSON.stringify(rows)).not.toMatch(/412345XXXXXX5678|50100012341234/);
  });

  it("fails reconciliation when a row is missing", async () => {
    const statement = parseStatement(
      await extractPages(pdf("pdf/hdfc-bad-reconciliation.pdf")),
    )!;
    const result = reconcile(statement);
    expect(result.ok).toBe(false);
    expect(result.differencePaise).toBe(-150_000);
  });

  it.each([
    ["sbi", "SBI", 3, 3_775_000],
    ["icici", "ICICI", 2, 5_965_000],
    ["axis", "Axis", 2, 155_000],
    ["kotak", "Kotak", 2, 278_000],
  ])("parses the %s layout", async (file, bank, count, net) => {
    const statement = parseStatement(
      await extractPages(pdf(`pdf/${file}.pdf`)),
    )!;
    expect(statement.bank).toBe(bank);
    expect(statement.rows).toHaveLength(count);
    const result = reconcile(statement);
    expect(result.ok).toBe(true);
    expect(result.creditsPaise - result.debitsPaise).toBe(net);
    expect(statement.last4).toBe("1234");
  });
});

describe("CAS", () => {
  it("parses CAMS folios, transactions and closing units without personal details", async () => {
    const cas = parseCas(await extractPages(pdf("cas/cams.pdf")))!;
    expect(cas.format).toBe("cams");
    expect(cas.periodTo).toBe("2026-10-31");
    expect(cas.holdings).toHaveLength(2);
    const [bluechip, liquid] = cas.holdings;
    expect(bluechip).toMatchObject({
      isin: "INF000A01011",
      schemeCode: "100001",
      folio: "1234567/89",
      units: 175.238,
      asOf: "2026-10-31",
      needsReview: false,
    });
    expect(bluechip.txns.map((txn) => txn.type)).toEqual([
      "sip",
      "sip",
      "sell",
    ]);
    expect(bluechip.costPaise).toBe(890_000n);
    expect(bluechip.pricePaise).toBe(6_000n);
    expect(liquid.needsReview).toBe(true);
    expect(
      JSON.stringify(cas, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(
      /ABCDE1234F|TEST INVESTOR|investor@example|9876543210|Test Street/,
    );
  });

  it("parses NSDL holdings by section", async () => {
    const cas = parseCas(await extractPages(pdf("cas/nsdl.pdf")))!;
    expect(cas.format).toBe("nsdl");
    expect(
      cas.holdings.map((item) => [item.kind, item.isin, item.units]),
    ).toEqual([
      ["stock", "INE000A01010", 10],
      ["etf", "INF000E01010", 100],
      ["bond", "INE000B07010", 5],
      ["mf", "INF000A01011", 120.5],
    ]);
    expect(cas.holdings[0].valuePaise).toBe(2_500_000n);
    expect(cas.holdings[0].asOf).toBe("2026-10-31");
  });

  it("validates units with a tolerance of 0.001", () => {
    const txn = {
      date: "2026-01-01",
      type: "buy" as const,
      amountPaise: 0n,
      navPaise: 0n,
      description: "",
    };
    expect(
      unitsReconcile({
        openingUnits: 0,
        units: 10.0005,
        txns: [{ ...txn, units: 10 }],
      }),
    ).toBe(true);
    expect(
      unitsReconcile({
        openingUnits: 0,
        units: 10.01,
        txns: [{ ...txn, units: 10 }],
      }),
    ).toBe(false);
  });

  it("converts rupees with four decimals to paise", () => {
    expect(rupeesToPaiseBig("55.0000")).toBe(5500n);
    expect(rupeesToPaiseBig("2,100.0050")).toBe(210_001n);
    expect(rupeesToPaiseBig(10.5)).toBe(1050n);
  });
});

describe("xirr", () => {
  it("matches a known annual return", () => {
    expect(
      xirr([
        { date: "2025-01-01", amount: -10_000 },
        { date: "2026-01-01", amount: 11_000 },
      ]),
    ).toBeCloseTo(0.1, 3);
  });
  it("handles monthly SIPs", () => {
    const flows = Array.from({ length: 12 }, (_, i) => ({
      date: `2025-${String(i + 1).padStart(2, "0")}-01`,
      amount: -1000,
    }));
    const rate = xirr([...flows, { date: "2026-01-01", amount: 12_800 }])!;
    expect(rate).toBeGreaterThan(0.1);
    expect(rate).toBeLessThan(0.16);
  });
  it("returns null without both signs", () => {
    expect(xirr([{ date: "2025-01-01", amount: -1 }])).toBeNull();
  });
});
