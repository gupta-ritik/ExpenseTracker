"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../auth";
import { seedSample } from "./sample";

export async function loadSampleData() {
  const { id } = await requireUser();
  const inserted = await seedSample(id);
  for (const path of ["/dashboard", "/transactions", "/accounts", "/budgets", "/reports"]) revalidatePath(path);
  return inserted;
}
