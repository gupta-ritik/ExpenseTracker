"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "../auth";
import { db } from "../db";
import {
  accounts,
  budgets,
  categories,
  recurring,
  transactions,
  userPreferences,
} from "../db/schema";
import { user } from "../db/auth-schema";
import { markDeleted, ownedEntry, writeEntry } from "./ledger";
import {
  accountSchema,
  budgetSchema,
  categorySchema,
  currencySchema,
  entrySchema,
  fieldErrors,
  recurringFrequency,
} from "./validation";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: ReturnType<typeof fieldErrors> };

function invalidateLedger() {
  for (const path of [
    "/dashboard",
    "/transactions",
    "/accounts",
    "/budgets",
    "/reports",
    "/settings",
    "/recurring",
  ]) {
    revalidatePath(path);
  }
}

function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: "Check the highlighted fields.",
    fields: fieldErrors(error),
  };
}

function denied(error: string): ActionResult<never> {
  return { ok: false, error };
}

function failed(error: unknown, fallback: string): ActionResult<never> {
  console.error(fallback, error instanceof Error ? error.message : error);
  return denied(fallback);
}

export async function saveEntry(
  raw: unknown,
  entryId?: string,
): Promise<ActionResult<typeof transactions.$inferSelect>> {
  const { id: userId } = await requireUser();
  const result = await writeEntry(userId, raw, entryId);
  if (!result.ok)
    return { ok: false, error: result.error, fields: result.fields };
  invalidateLedger();
  return result;
}

export async function setEntryDeleted(
  entryId: string,
  deleted: boolean,
): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const result = await markDeleted(userId, entryId, deleted);
  if (!result.ok) return { ok: false, error: result.error };
  invalidateLedger();
  return result;
}

export async function saveRecurring(
  raw: unknown,
  frequency: unknown,
): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const entry = entrySchema.safeParse(raw);
  const period = recurringFrequency.safeParse(frequency);
  if (!entry.success) return invalid(entry.error);
  if (!period.success) return denied("Choose a recurrence frequency.");
  try {
    const draft = await ownedEntry(userId, entry.data);
    if (!draft)
      return denied("Choose an account and category that belong to you.");
    await db()
      .insert(recurring)
      .values({
        ...draft,
        frequency: period.data,
        nextDate: entry.data.date,
        anchorDate: entry.data.date,
      });
    invalidateLedger();
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error, "Could not save the recurring transaction.");
  }
}

export async function toggleRecurring(
  templateId: string,
  active: boolean,
): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  if (!z.uuid().safeParse(templateId).success || typeof active !== "boolean")
    return denied("Invalid recurring entry.");
  const [item] = await db()
    .update(recurring)
    .set({ active })
    .where(and(eq(recurring.userId, userId), eq(recurring.id, templateId)))
    .returning({ id: recurring.id });
  if (!item) return denied("Recurring entry could not be found.");
  invalidateLedger();
  return { ok: true, data: undefined };
}

export async function saveAccount(
  raw: unknown,
  accountId?: string,
): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (accountId && !z.uuid().safeParse(accountId).success)
    return denied("Invalid account.");
  const { name, type, openingBalance } = parsed.data;
  const values = { name, type, openingBalancePaise: openingBalance };
  try {
    const [item] = accountId
      ? await db()
          .update(accounts)
          .set(values)
          .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
          .returning({ id: accounts.id })
      : await db()
          .insert(accounts)
          .values({ ...values, userId })
          .returning({ id: accounts.id });
    if (!item) return denied("Account could not be found.");
    invalidateLedger();
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(
      error,
      "Could not save the account. Account names must be unique.",
    );
  }
}

export async function saveCategory(
  raw: unknown,
  categoryId?: string,
): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (categoryId && !z.uuid().safeParse(categoryId).success)
    return denied("Invalid category.");
  try {
    const [item] = categoryId
      ? await db()
          .update(categories)
          .set({ name: parsed.data.name })
          .where(
            and(eq(categories.userId, userId), eq(categories.id, categoryId)),
          )
          .returning({ id: categories.id })
      : await db()
          .insert(categories)
          .values({ ...parsed.data, userId })
          .returning({ id: categories.id });
    if (!item) return denied("Category could not be found.");
    invalidateLedger();
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(
      error,
      "Could not save the category. Category names must be unique for each type.",
    );
  }
}

export async function removeSetting(
  kind: "account" | "category" | "budget",
  id: string,
): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  if (
    !z.uuid().safeParse(id).success ||
    !z.enum(["account", "category", "budget"]).safeParse(kind).success
  ) {
    return denied("Invalid selection.");
  }
  try {
    const table = { account: accounts, category: categories, budget: budgets }[
      kind
    ];
    const [item] = await db()
      .delete(table)
      .where(and(eq(table.userId, userId), eq(table.id, id)))
      .returning({ id: table.id });
    if (!item) return denied("Item could not be found.");
    invalidateLedger();
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(
      error,
      "Could not delete this item while other records use it.",
    );
  }
}

export async function saveBudget(raw: unknown): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const parsed = budgetSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { categoryId, month, limit } = parsed.data;
  try {
    if (
      categoryId &&
      !(await db().$count(
        categories,
        and(
          eq(categories.userId, userId),
          eq(categories.id, categoryId),
          eq(categories.type, "expense"),
        ),
      ))
    )
      return denied("Choose one of your expense categories.");
    await db()
      .insert(budgets)
      .values({
        userId,
        categoryId: categoryId || null,
        month,
        limitPaise: limit,
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: { limitPaise: limit },
      });
    invalidateLedger();
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error, "Could not save the budget.");
  }
}

export async function saveCurrency(raw: unknown): Promise<ActionResult> {
  const { id: userId } = await requireUser();
  const parsed = currencySchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  await db()
    .insert(userPreferences)
    .values({ userId, currency: parsed.data })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { currency: parsed.data },
    });
  invalidateLedger();
  return { ok: true, data: undefined };
}

export async function deleteProfile(confirm: unknown): Promise<ActionResult> {
  const account = await requireUser();
  if (confirm !== account.email)
    return denied("Enter your email address to confirm deletion.");
  try {
    await db().delete(user).where(eq(user.id, account.id));
    return { ok: true, data: undefined };
  } catch (error) {
    return failed(error, "Could not delete your account.");
  }
}
