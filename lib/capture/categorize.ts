import { normalizeMerchant } from "./normalize";

export type CategoryRef = {
  id: string;
  name: string;
  type: "expense" | "income";
};
export type MerchantRule = { pattern: string; categoryId: string };

/** Built-in India keyword rules, checked after the user's own merchant rules. */
export const keywordRules: {
  name: string;
  type: "expense" | "income";
  pattern: RegExp;
}[] = [
  {
    name: "Refund",
    type: "income",
    pattern: /\b(?:REFUND|REVERSAL|REVERSED|CASHBACK)\b/,
  },
  {
    name: "Salary",
    type: "income",
    pattern: /\b(?:SALARY|SAL CREDIT|PAYROLL)\b/,
  },
  {
    name: "Interest",
    type: "income",
    pattern: /\b(?:INT\s?PD|INTEREST|INT CREDIT|SB INT)\b/,
  },
  {
    name: "Food",
    type: "expense",
    pattern: /\b(?:SWIGGY|ZOMATO|DOMINOS|MCDONALDS|STARBUCKS|EATSURE)\b/,
  },
  {
    name: "Groceries",
    type: "expense",
    pattern:
      /\b(?:BIGBASKET|BIG BASKET|BLINKIT|ZEPTO|DMART|INSTAMART|JIOMART)\b/,
  },
  {
    name: "Transport",
    type: "expense",
    pattern: /\b(?:UBER|OLA|OLACABS|RAPIDO|METRO|NAMMA YATRI|FASTAG)\b/,
  },
  {
    name: "Mobile & Internet",
    type: "expense",
    pattern: /\b(?:AIRTEL|JIO|RELIANCE JIO|VODAFONE|VI|BSNL|ACT FIBERNET)\b/,
  },
  {
    name: "Shopping",
    type: "expense",
    pattern: /\b(?:AMAZON|FLIPKART|MYNTRA|AJIO|MEESHO|NYKAA)\b/,
  },
  {
    name: "Travel",
    type: "expense",
    pattern:
      /\b(?:IRCTC|MAKEMYTRIP|MAKE MY TRIP|GOIBIBO|INDIGO|CLEARTRIP|REDBUS)\b/,
  },
  {
    name: "Fuel",
    type: "expense",
    pattern:
      /\b(?:PETROL|FUEL|HPCL|BPCL|IOCL|INDIAN OIL|SHELL|FILLING STATION)\b/,
  },
  {
    name: "Investments",
    type: "expense",
    pattern:
      /\b(?:SIP|MUTUAL FUND|MF|ZERODHA|GROWW|KUVERA|COIN BY ZERODHA|NSE CLEARING|BSE)\b/,
  },
  { name: "EMI/Loan", type: "expense", pattern: /\b(?:EMI|LOAN|NACH|ECS)\b/ },
];

export type Categorized = {
  categoryId: string;
  matched: "rule" | "keyword" | "hint" | "fallback";
};

/**
 * Picks a category id from the user's own categories. The returned id always
 * belongs to `categories`; a model hint can only select among them by name.
 */
export function categorize(
  input: {
    merchant: string;
    note?: string;
    type: "expense" | "income";
    hint?: string;
  },
  categories: CategoryRef[],
  rules: MerchantRule[] = [],
): Categorized | null {
  const owned = categories.filter((item) => item.type === input.type);
  const ids = new Set(owned.map((item) => item.id));
  const haystack = normalizeMerchant(`${input.merchant} ${input.note ?? ""}`);
  const merchant = normalizeMerchant(input.merchant);
  const rule = [...rules]
    .sort((a, b) => b.pattern.length - a.pattern.length)
    .find(
      (item) =>
        ids.has(item.categoryId) &&
        item.pattern &&
        (merchant === item.pattern ||
          (" " + haystack + " ").includes(" " + item.pattern + " ")),
    );
  if (rule) return { categoryId: rule.categoryId, matched: "rule" };
  const byName = (name: string) =>
    owned.find((item) => item.name.toLowerCase() === name.toLowerCase());
  for (const keyword of keywordRules) {
    if (keyword.type !== input.type || !keyword.pattern.test(haystack))
      continue;
    const category = byName(keyword.name);
    if (category) return { categoryId: category.id, matched: "keyword" };
  }
  if (input.hint) {
    const category = byName(input.hint);
    if (category && category.name !== "Other")
      return { categoryId: category.id, matched: "hint" };
  }
  const other = byName("Other");
  return other ? { categoryId: other.id, matched: "fallback" } : null;
}

export function rulePattern(merchant: string) {
  return normalizeMerchant(merchant).slice(0, 80);
}
