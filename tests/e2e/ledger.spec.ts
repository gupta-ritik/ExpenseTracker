import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("sign up, track spending, move money, dedupe, export and sign out", async ({
  page,
}) => {
  const email = `ledger-${randomUUID()}@expense.local`;
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Ledger tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("strong-demo-2026");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/budgets");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Food" });
  await page.getByLabel("Monthly limit").fill("1000");
  await page.getByRole("button", { name: "Save budget" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Food budget used" }),
  ).toHaveAttribute("value", "0");

  await page.goto("/dashboard");
  await page.keyboard.press("n");
  const entry = page.getByRole("dialog");
  await expect(entry.getByLabel("Amount", { exact: true })).toBeFocused();
  await entry.getByLabel("Amount", { exact: true }).fill("250.50");
  await entry.getByRole("button", { name: "Food", exact: true }).click();
  await entry
    .getByRole("combobox", { name: "Account", exact: true })
    .selectOption({ label: "Bank" });
  await entry
    .getByLabel("Note", { exact: true })
    .fill("Lunch near the station");
  await entry
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(page.getByText("Lunch near the station")).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Food budget used" }),
  ).toHaveAttribute("value", "25");

  await page.goto("/transactions");
  await page
    .getByRole("button", { name: "Edit Lunch near the station" })
    .click();
  await entry.getByLabel("Note", { exact: true }).fill("Lunch with a friend");
  await entry.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Lunch with a friend")).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Lunch with a friend" })
    .click();
  await expect(page.getByText("Lunch with a friend")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByText("Lunch with a friend")).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  await entry.getByRole("button", { name: "transfer", exact: true }).click();
  await entry.getByLabel("Amount", { exact: true }).fill("100");
  await entry
    .getByRole("combobox", { name: "From account", exact: true })
    .selectOption({ label: "Bank" });
  await entry
    .getByRole("combobox", { name: "To account", exact: true })
    .selectOption({ label: "Cash" });
  await entry.getByLabel("Note", { exact: true }).fill("Cash withdrawal");
  await entry
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await expect(entry).toBeHidden();
  await expect(
    page.locator(".entries").getByText("Cash withdrawal"),
  ).toBeVisible();
  await page.goto("/accounts");
  const balances = page.getByRole("region", { name: "Account balances" });
  await expect(
    balances.locator(".metric").filter({ hasText: "Bank" }),
  ).toContainText("₹350.50");
  await expect(
    balances.locator(".metric").filter({ hasText: "Cash" }),
  ).toContainText("₹100.00");

  await page.goto("/import");
  await page
    .getByLabel("Statement CSV")
    .setInputFiles(resolve("tests/fixtures/sbi.csv"));
  await page.getByRole("button", { name: "Preview rows" }).click();
  await expect(page.getByText("2 new · 0 duplicate · 0 skipped")).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText(/new rows imported/)).toContainText(
    "2 new rows imported",
  );
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText(/new rows imported/)).toContainText(
    "0 new rows imported",
  );

  await page.goto("/settings");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export CSV" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^expenses-.*\.csv$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toContain("UPI tea stall");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
});
