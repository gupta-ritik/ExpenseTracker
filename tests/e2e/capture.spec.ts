import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const fixture = (path: string) => resolve(__dirname, "../fixtures", path);
const messages = [
  "Sent Rs.499.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 25/11/26\nRef 433112345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
  "Rs.777.00 spent on HDFC Bank Card 5678 At NEW CORNER CAFE On 2026-11-24:10:00:00 Bal Rs.45,000.00",
  "123456 is your OTP for transaction of Rs.2,499.00 at AMAZON on HDFC Bank Card 5678. Do not share. -HDFC Bank",
].join("\n\n");

test("paste SMS, review, import PDF statements and CAS, then manage tokens", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Capture tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`capture-${randomUUID()}@expense.local`);
  await page.getByLabel("Password", { exact: true }).fill("strong-demo-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Paste three SMS: two parse, the OTP is ignored.
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Paste SMS" }).click();
  await dialog.getByLabel("Bank SMS").fill(messages);
  await dialog.getByRole("button", { name: "Preview" }).click();
  const parsed = dialog.getByRole("list", { name: "Parsed messages" });
  await expect(parsed.getByText("Parsed")).toHaveCount(2);
  await expect(parsed.getByText("Verification code")).toBeVisible();
  await dialog.getByRole("button", { name: "Save 2 parsed" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "2 saved · 0 duplicate · 1 to review · 1 ignored",
  );
  await dialog.getByRole("button", { name: "Done" }).click();

  // Review: recategorize with a merchant rule, then approve.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "1 transactions to review" }).click();
  await expect(page).toHaveURL(/\/review$/);
  const item = page
    .getByRole("listitem")
    .filter({ hasText: "NEW CORNER CAFE" });
  await item
    .getByRole("combobox", { name: "Category" })
    .selectOption({ label: "Food" });
  await item
    .getByRole("button", { name: "Always use this for NEW CORNER CAFE" })
    .click();
  await expect(
    page.getByText("NEW CORNER CAFE will always use this category."),
  ).toBeVisible();
  await page.keyboard.press("a");
  await expect(
    page.getByRole("heading", { name: "Nothing to review" }),
  ).toBeVisible();

  // Password-protected HDFC statement: reconcile, import, re-import.
  await page.goto("/import");
  await page.getByRole("tab", { name: "PDF statement" }).click();
  await page
    .getByLabel(/^Statement PDF/)
    .setInputFiles(fixture("pdf/hdfc.pdf"));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator(".field-error[role=alert]")).toContainText(
    "password protected",
  );
  await page.getByLabel(/^PDF password/).fill("TEST1234");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.getByText("// RECONCILED: OPENING + CREDITS − DEBITS = CLOSING"),
  ).toBeVisible();
  await expect(
    page.getByText("2026-11-01 → 2026-11-30 · 5 rows"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "new rows imported" }),
  ).toHaveText("4 new rows imported · 1 duplicates skipped · 1 to review.");
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "new rows imported" }),
  ).toHaveText("0 new rows imported · 5 duplicates skipped · 0 to review.");

  // A statement that does not reconcile imports nothing.
  await page
    .getByLabel(/^Statement PDF/)
    .setInputFiles(fixture("pdf/hdfc-bad-reconciliation.pdf"));
  await page.getByLabel(/^PDF password/).fill("");
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.locator(".field-error[role=alert]")).toContainText(
    "Reconciliation failed",
  );
  await expect(page.locator(".field-error[role=alert]")).toContainText(
    "Nothing was imported.",
  );
  await expect(
    page.getByRole("button", { name: "Confirm import" }),
  ).toHaveCount(0);

  // CAS upload.
  await page.getByRole("tab", { name: "CAS (investments)" }).click();
  await page.getByLabel(/^CAS PDF/).setInputFiles(fixture("cas/cams.pdf"));
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(
    page.getByText("Units don’t add up: needs review"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "holdings updated" }),
  ).toHaveText("2 holdings updated · 4 new transactions · 0 already imported.");
  await page.reload();
  await expect(page.getByRole("cell", { name: "[CAS]" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "[SMS]" })).toBeVisible();

  await page.goto("/investments");
  await expect(
    page.getByRole("cell", { name: /Acme Bluechip Fund/ }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByLabel("This month’s totals").getByText("Net worth"),
  ).toBeVisible();

  // Ingest token: create (shown once) and revoke.
  await page.goto("/settings");
  await page.getByLabel("Token name").fill("E2E forwarder");
  await page.getByRole("button", { name: "Create token" }).click();
  await expect(
    page.getByRole("status", { name: "New ingest token" }),
  ).toContainText(/^et_/);
  const token = page.getByRole("listitem").filter({ hasText: "E2E forwarder" });
  await token.getByRole("button", { name: "Revoke" }).click();
  await expect(token).toContainText("Revoked");
});
