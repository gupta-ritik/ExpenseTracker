// Pure zod schemas shared by the API routes and the mobile app.
import { z } from "zod";

export const entryInput = z.object({
  type: z.enum(["expense", "income", "transfer"]),
  amountPaise: z.number().int().positive().max(2_147_483_647),
  date: z.iso.date(),
  note: z.string().max(300).default(""),
  tags: z.array(z.string().max(40)).max(12).default([]),
  accountId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
  toAccountId: z.uuid().nullable().optional(),
});
export type EntryInput = z.infer<typeof entryInput>;
export const entryPatch = entryInput.partial();

export const listQuery = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(80).optional(),
  type: z.enum(["expense", "income", "transfer"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const reviewAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({
    action: z.literal("edit"),
    categoryId: z.uuid().optional(),
    always: z.boolean().default(false),
    entry: entryPatch.optional(),
  }),
]);

export const deviceRegistration = z.object({
  name: z.string().trim().min(1).max(80).default("Android device"),
  model: z.string().max(80).optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(40).optional(),
});

export type ApiError = { error: { code: string; message: string } };
export type Page<T> = { items: T[]; nextCursor: string | null };
