const maxPaise = 2_147_483_647;
export const currencies = ["INR", "USD", "EUR", "GBP"] as const;
export type Currency = typeof currencies[number];

export function formatMoney(paise: number, currency: Currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(paise / 100);
}

export function paiseToRupees(paise: number) {
  const absolute = Math.abs(paise);
  return `${paise < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function rupeesToPaise(input: string): number | null {
  const value = input.trim();
  const parsed = /^(-?)(\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.(\d{1,2}))?$/.exec(value);
  if (!parsed) return null;
  const [, sign, units, fraction] = parsed;
  const result = Number(units.replaceAll(",", "")) * 100 + Number((fraction ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > maxPaise) return null;
  return sign === "-" && result > 0 ? -result : result;
}

export function budgetPercent(spent: number, limit: number) {
  return limit > 0 ? Math.floor(spent * 100 / limit) : 0;
}

export type EntryType = "expense" | "income" | "transfer";

export function accountBalances(
  accounts: { id: string; openingBalancePaise: number }[],
  entries: { accountId: string; toAccountId: string | null; type: EntryType; amountPaise: number }[],
) {
  const balances = new Map(accounts.map(account => [account.id, account.openingBalancePaise]));
  for (const entry of entries) {
    const balance = balances.get(entry.accountId);
    if (balance !== undefined) {
      balances.set(entry.accountId, balance + (entry.type === "income" ? entry.amountPaise : -entry.amountPaise));
    }
    if (entry.type === "transfer" && entry.toAccountId) {
      const destination = balances.get(entry.toAccountId);
      if (destination !== undefined) balances.set(entry.toAccountId, destination + entry.amountPaise);
    }
  }
  return balances;
}
