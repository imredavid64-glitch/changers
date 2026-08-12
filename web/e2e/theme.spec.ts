import { expect, test } from "@playwright/test";

/**
 * Signed-in shell tests via the QA seam: setting localStorage["changers-fake-user"]
 * = "1" renders the app chrome (topbar, nav, theme toggle) with a mock identity
 * and no backend. The seam is UI-only — API routes still require a real JWT.
 */
test.describe("Theme toggle (signed-in shell)", () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:3010",
          localStorage: [{ name: "changers-fake-user", value: "1" }],
        },
      ],
    },
  });

  /** Clicks the toggle until its label matches `target` (cycles 3 options). */
  async function cycleTo(page: import("@playwright/test").Page, toggle: import("@playwright/test").Locator, target: string) {
    for (let i = 0; i < 4; i += 1) {
      if ((await toggle.innerText()).includes(target)) return;
      await toggle.click();
    }
    throw new Error(`toggle never reached "${target}"`);
  }

  test("shell renders with the theme toggle and cycles through all three modes", async ({ page }) => {
    await page.goto("/messages");

    const toggle = page.getByRole("button", { name: /Color theme:/i });
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Cycle to dark and assert the attribute + storage.
    await cycleTo(page, toggle, "Dark");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    expect(await page.evaluate(() => localStorage.getItem("changers-theme"))).toBe("dark");

    // System mode: attribute follows the OS preference.
    await cycleTo(page, toggle, "System");
    const resolved = await page.evaluate(() =>
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(resolved);

    // Light mode.
    await cycleTo(page, toggle, "Light");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
    expect(await page.evaluate(() => localStorage.getItem("changers-theme"))).toBe("light");
  });

  test("system mode follows live OS color-scheme changes", async ({ page }) => {
    // Start in system mode (seeded pre-paint, like the no-FOUC script path).
    await page.addInitScript(() => {
      localStorage.setItem("changers-theme", "system");
    });
    await page.goto("/messages");
    const toggle = page.getByRole("button", { name: /Color theme:/i });
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await expect(toggle).toContainText("System");

    // Flip the emulated OS preference and assert the attribute reacts
    // (exercises the matchMedia change listener in ThemeToggle).
    await page.emulateMedia({ colorScheme: "dark" });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
      .toBe("light");

    // Storage stays "system" throughout — the OS drives the attribute.
    expect(await page.evaluate(() => localStorage.getItem("changers-theme"))).toBe("system");

    // And a reload re-resolves against the current OS preference.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(page.getByRole("button", { name: /Color theme:/i })).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  });

  test("theme choice persists across a reload", async ({ page }) => {
    await page.goto("/messages");
    const toggle = page.getByRole("button", { name: /Color theme:/i });
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    await cycleTo(page, toggle, "Dark");
    expect(await page.evaluate(() => localStorage.getItem("changers-theme"))).toBe("dark");

    await page.reload();
    await expect(page.getByRole("button", { name: /Color theme:/i })).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    expect(await page.evaluate(() => localStorage.getItem("changers-theme"))).toBe("dark");
  });
});
