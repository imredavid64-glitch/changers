import { expect, test, type Page } from "@playwright/test";

/**
 * Visual-regression net: screenshots the key routes in both themes and fails
 * on unexpected pixel changes. Run locally to catch styling regressions the
 * DOM assertions can't see (tint drift, broken tokens, layout shifts).
 *
 * Skipped in CI: the baselines are rendered with macOS system fonts (Avenir
 * Next, Iowan Old Style), so CI's Linux fonts would diff even on unchanged
 * code. Regenerate baselines after an intentional visual change with:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 */
test.describe("visual regression", () => {
  test.skip(!!process.env.CI, "font rendering differs between macOS and CI Linux; baselines are generated on the dev Mac");

  async function settled(page: Page) {
    await page.evaluate(() => (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready);
  }

  const themes = [
    { name: "light", storage: "light" },
    { name: "dark", storage: "dark" },
  ];

  test.describe("signed-out routes", () => {
    for (const t of themes) {
      test.use({
        storageState: {
          cookies: [],
          origins: [{ origin: "http://127.0.0.1:3010", localStorage: [{ name: "changers-theme", value: t.storage }] }],
        },
      });

      for (const [label, path] of [
        ["landing", "/"],
        ["contact", "/contact"],
        ["search", "/search?q=plastic"],
      ] as const) {
        test(`${label} renders clean in ${t.name}`, async ({ page }) => {
          test.info().annotations.push({ type: "theme", description: t.name });
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.goto(path);
          await settled(page);
          await expect
            .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
            .toBe(t.storage);
          await expect(page.locator("body")).toBeVisible();
          await expect(page).toHaveScreenshot(`${label}-${t.name}.png`, {
            animations: "disabled",
            maxDiffPixelRatio: 0.02,
          });
        });
      }
    }
  });

  test.describe("signed-in shell (fake-user seam)", () => {
    for (const t of themes) {
      test.use({
        storageState: {
          cookies: [],
          origins: [
            {
              origin: "http://127.0.0.1:3010",
              localStorage: [
                { name: "changers-theme", value: t.storage },
                { name: "changers-fake-user", value: "1" },
              ],
            },
          ],
        },
      });

      for (const [label, path] of [
        ["messages", "/messages"],
        ["posts", "/posts"],
      ] as const) {
        test(`${label} renders clean in ${t.name}`, async ({ page }) => {
          test.info().annotations.push({ type: "theme", description: t.name });
          await page.emulateMedia({ reducedMotion: "reduce" });
          await page.goto(path);
          await settled(page);
          await expect
            .poll(() => page.evaluate(() => document.documentElement.dataset.theme))
            .toBe(t.storage);
          await expect(page.getByRole("button", { name: /Color theme:/i })).toBeVisible({ timeout: 10_000 });
          await expect(page).toHaveScreenshot(`${label}-${t.name}.png`, {
            animations: "disabled",
            maxDiffPixelRatio: 0.02,
          });
        });
      }
    }
  });
});
