import { test, expect } from "@playwright/test";

test("dashboard and wizard shells load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Create new kit/i }).first()).toBeVisible();
  await page.getByRole("link", { name: /Create new kit/i }).first().click();
  await expect(page).toHaveURL(/\/wizard$/);
  await expect(page.getByRole("heading", { name: /choose your content path/i })).toBeVisible();

  await page.getByRole("button", { name: /Start social wizard/i }).first().click();
  await expect(page).toHaveURL(/\/wizard\/social$/);
  await expect(page.getByRole("heading", { name: /Social Campaign Wizard/i })).toBeVisible();

  await page.goto("/help");
  await expect(page).toHaveURL(/\/wizard$/);
  await expect(page.getByRole("heading", { name: /choose your content path/i })).toBeVisible();

  await page.goto("/integrations");
  await expect(page).toHaveURL(/\/wizard$/);
  await expect(page.getByRole("heading", { name: /choose your content path/i })).toBeVisible();
});
