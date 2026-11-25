import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("landing and ledger layouts fit across desktop and mobile", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Name", { exact: true }).fill("Design review");
  await page.getByLabel("Email", { exact: true }).fill(`design-${randomUUID()}@expense.local`);
  await page.getByLabel("Password", { exact: true }).fill("strong-design-2026");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  for (const [route, heading] of [
    ["/", "Track your expenses in rupees."],
    ["/dashboard", "Dashboard"],
    ["/transactions", "Transactions"],
    ["/import", "Import bank CSV"],
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
    for (const width of [1440, 1024, 820, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.documentWidth, `${route} overflows at ${width}px`).toBeLessThanOrEqual(dimensions.viewportWidth);
    }
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(10, 10, 10)");
  const mobileHeight = await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Dashboard" }).boundingBox();
  expect(mobileHeight?.height).toBeGreaterThanOrEqual(44);
});
