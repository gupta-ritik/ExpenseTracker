import { z } from "zod";
import { frequencies } from "./dates";
import { currencies, rupeesToPaise } from "./money";

const uuid = z.uuid();
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const moneyInput = z.string().trim().transform((input, context) => {
  const paise = rupeesToPaise(input);
  if (paise === null) {
    context.addIssue({ code: "custom", message: "Enter a valid amount with up to two decimal places." });
    return z.NEVER;
  }
  return paise;
});
const positiveAmount = moneyInput.pipe(z.number().int().positive("Enter an amount greater than zero."));

const entryBase = z.object({
  amount: positiveAmount,
  date: z.iso.date(),
  note: z.string().trim().max(300),
  tags: z.string().max(250).transform(input =>
    Array.from(new Set(input.split(",").map(tag => tag.trim()).filter(Boolean))).slice(0, 12)
  ),
  accountId: uuid,
});
export const entrySchema = entryBase.extend({
  type: z.enum(["expense", "income", "transfer"]),
  categoryId: z.union([uuid, z.literal("")]),
  toAccountId: z.union([uuid, z.literal("")]),
}).superRefine((entry, context) => {
  if (entry.type === "transfer") {
    if (!entry.toAccountId || entry.toAccountId === entry.accountId) {
      context.addIssue({ code: "custom", path: ["toAccountId"], message: "Choose a different destination account." });
    }
    if (entry.categoryId) context.addIssue({ code: "custom", path: ["categoryId"], message: "Transfers do not use a category." });
  } else {
    if (!entry.categoryId) context.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a category." });
    if (entry.toAccountId) context.addIssue({ code: "custom", path: ["toAccountId"], message: "Only transfers have a destination account." });
  }
});
export const recurringFrequency = z.enum(frequencies);
export const accountSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["cash", "bank", "upi", "card"]),
  openingBalance: moneyInput,
});
export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["expense", "income"]),
});
export const budgetSchema = z.object({
  categoryId: z.union([uuid, z.literal("")]),
  month: monthSchema,
  limit: positiveAmount,
});
export const currencySchema = z.enum(currencies);

export function fieldErrors(error: z.ZodError) {
  return error.issues.map(issue => ({ field: String(issue.path[0] ?? ""), message: issue.message }));
}
