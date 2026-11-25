import { describe, expect, it } from "vitest";
import { accountBalances, budgetPercent, formatMoney, paiseToRupees, rupeesToPaise } from "../../lib/expense/money";
import { indiaToday, nextOccurrence } from "../../lib/expense/dates";

describe("integer money", () => {
  it("formats Indian grouping and preserves paise", () => {
    expect(formatMoney(12_345_600)).toBe("₹1,23,456.00");
    expect(rupeesToPaise("1,23,456.05")).toBe(12_345_605);
    expect(rupeesToPaise("-0.29")).toBe(-29);
    expect(paiseToRupees(-29)).toBe("-0.29");
    expect(rupeesToPaise("1.005")).toBeNull();
    expect(rupeesToPaise("3,4,567")).toBeNull();
    expect(rupeesToPaise("21474836.48")).toBeNull();
  });
  it("calculates warning and limit percentages", () => {
    expect(budgetPercent(7999, 10000)).toBe(79);
    expect(budgetPercent(8000, 10000)).toBe(80);
    expect(budgetPercent(10100, 10000)).toBe(101);
    expect(budgetPercent(200, 0)).toBe(0);
  });
  it("moves a transfer between accounts without affecting the total", () => {
    const balances = accountBalances([{ id: "bank", openingBalancePaise: 10000 }, { id: "cash", openingBalancePaise: 0 }], [
      { type: "expense", amountPaise: 500, accountId: "bank", toAccountId: null },
      { type: "income", amountPaise: 9000, accountId: "bank", toAccountId: null },
      { type: "transfer", amountPaise: 2000, accountId: "bank", toAccountId: "cash" },
    ]);
    expect(Object.fromEntries(balances)).toEqual({ bank: 16500, cash: 2000 });
  });
});

describe("recurring dates", () => {
  it("uses the Indian calendar day and preserves the template day", () => {
    expect(indiaToday(new Date("2026-11-24T20:00:00Z"))).toBe("2026-11-25");
    expect(nextOccurrence("2024-01-31", "monthly")).toBe("2024-02-29");
    expect(nextOccurrence("2024-02-29", "monthly", "2024-01-31")).toBe("2024-03-31");
    expect(nextOccurrence("2025-02-28", "yearly", "2024-02-29")).toBe("2026-02-28");
    expect(nextOccurrence("2024-02-28", "daily")).toBe("2024-02-29");
    expect(nextOccurrence("2024-02-28", "weekly")).toBe("2024-03-06");
  });
});
