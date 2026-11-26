import { useQuery } from "@tanstack/react-query";
import { formatMoney, type Currency } from "@expense-tracker/shared/money";
import { indiaToday } from "@expense-tracker/shared/dates";
import { api, type Account, type Category, type Transaction } from "./api";

/** Banks cut merchant names short ("FLIPKARTINTERNE"); show the brand instead. */
const brands = [
  "Amazon",
  "Airtel",
  "BigBasket",
  "BookMyShow",
  "Blinkit",
  "Flipkart",
  "Google",
  "IRCTC",
  "Jio",
  "Myntra",
  "Netflix",
  "Ola",
  "Paytm",
  "PhonePe",
  "Rapido",
  "Spotify",
  "Swiggy",
  "Uber",
  "Zepto",
  "Zomato",
];

export function displayMerchant(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const squashed = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  const brand = brands.find((item) => squashed.startsWith(item.toLowerCase()));
  if (brand) return brand;
  // Title-case names that arrive in all capitals; leave mixed case alone.
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\b(Upi|Neft|Imps|Atm|Sbi|Icici|Hdfc|Axis|Emi)\b/g, (word) =>
      word.toUpperCase(),
    );
}

export function entryTitle(item: Transaction) {
  return (
    displayMerchant(item.merchant ?? "") ||
    item.note ||
    (item.type === "income"
      ? "Income"
      : item.type === "transfer"
        ? "Transfer"
        : "Expense")
  );
}

export function signedAmount(item: Transaction, currency: Currency) {
  const money = formatMoney(item.amountPaise, currency);
  if (item.type === "income") return "+" + money;
  if (item.type === "expense") return "−" + money;
  return money;
}

/** "Today", "Yesterday", else "Sat, 22 Nov" (adds the year when it differs). */
export function dateHeading(date: string) {
  const today = indiaToday();
  if (date === today) return "Today";
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (date === yesterday) return "Yesterday";
  const value = new Date(date + "T00:00:00Z");
  return value.toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
  });
}

const sourceNames: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  pdf: "Statement",
  cas: "CAS",
};

/** Accounts and categories, shared with the entry form's cache. */
export function useLookups() {
  return useQuery({
    queryKey: ["entry-options"],
    queryFn: async () => {
      const [accounts, categories] = await Promise.all([
        api<{ items: Account[] }>("/accounts"),
        api<{ items: Category[] }>("/categories"),
      ]);
      return { accounts: accounts.items, categories: categories.items };
    },
    staleTime: 5 * 60_000,
  });
}

/** "Food · ICICI ••3007 · SMS", skipping what isn't known. */
export function entryDetail(
  item: Transaction,
  lookups?: { accounts: Account[]; categories: Category[] },
  withDate = false,
) {
  const category = lookups?.categories.find(
    (value) => value.id === item.categoryId,
  )?.name;
  const account = lookups?.accounts.find(
    (value) => value.id === item.accountId,
  )?.name;
  return [
    withDate ? dateHeading(item.date) : undefined,
    item.type === "transfer" ? undefined : (category ?? "Uncategorized"),
    account,
    sourceNames[item.source],
  ]
    .filter(Boolean)
    .join(" · ");
}
