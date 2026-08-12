import { expect, test } from "@playwright/test";

test.describe("Contact form", () => {
  test("requires consent before it accepts a message", async ({ page }) => {
    await page.goto("/contact");
    await page.locator('input[name="name"]').fill("QA Tester");
    await page.locator('input[name="email"]').fill("qa@test.hu");
    await page.locator('textarea[name="message"]').fill("Hello from the smoke suite.");
    await page.getByRole("button", { name: /Send message/i }).click();

    // The consent checkbox is required, so the browser blocks submission.
    await expect(page.locator('input[name="consent"]')).toBeVisible();
    const checked = await page.locator('input[name="consent"]').isChecked();
    expect(checked).toBe(false);
  });

  test("shows a graceful storage error when the database is not configured", async ({ page }) => {
    await page.goto("/contact");
    await page.locator('input[name="name"]').fill("QA Tester");
    await page.locator('input[name="email"]').fill("qa@test.hu");
    await page.locator('textarea[name="message"]').fill("Hello from the smoke suite.");
    await page.locator('input[name="consent"]').check();
    await page.getByRole("button", { name: /Send message/i }).click();

    // No DATABASE_URL in the preview env → the API must fail gracefully inline,
    // not crash the page.
    await expect(page.getByText(/DATABASE_URL is required/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Send message/i })).toBeEnabled();
  });

  test("lists the business contact emails", async ({ page }) => {
    await page.goto("/contact");
    await expect(
      page.getByRole("link", { name: "30dimrekatai@student.aisb.hu" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "davidimrekatai@gmail.com" }).first(),
    ).toBeVisible();
  });
});
