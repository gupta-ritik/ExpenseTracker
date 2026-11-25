import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importFingerprint, parseStatement } from "../../lib/expense/csv";

describe("bank statement CSV", () => {
  it.each([
    ["sbi", 4550, 26600], ["hdfc", 124900, 25050], ["icici", 35000, 12500],
    ["axis", 62000, 1250000], ["kotak", 9820, 5600],
  ] as const)("parses %s debit and credit", (preset, debit, credit) => {
    const csv = readFileSync(`tests/fixtures/${preset}.csv`, "utf8");
    const result = parseStatement(csv, preset);
    expect(result.mappingError).toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.entries.map(row => [row.date, row.type, row.amountPaise])).toEqual([
      ["2026-11-24", "expense", debit], ["2026-11-25", "income", credit],
    ]);
  });
  it("accepts custom mapping and identifies equivalent rows", () => {
    const result = parseStatement("Day,What,Value\n24/11/2026,Street Tea,-60.00\n24/11/2026,street   tea,-60.0", "generic", {
      date: 0, description: 1, amount: 2,
    });
    expect(result.entries).toHaveLength(2);
    expect(importFingerprint(result.entries[0])).toBe(importFingerprint(result.entries[1]));
    expect(importFingerprint({ ...result.entries[0], type: "income" })).not.toBe(importFingerprint(result.entries[1]));
  });
});
