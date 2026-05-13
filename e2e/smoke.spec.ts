import { test, expect } from "@playwright/test";

test("home responds", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/HR Management/i);
});
