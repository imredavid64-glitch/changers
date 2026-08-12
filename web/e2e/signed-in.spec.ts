import { expect, test } from "@playwright/test";

/**
 * Signed-in smoke: renders the app shell + page chrome for every app route
 * behind the fake-user QA seam (no backend required). The seam is UI-only —
 * data fetches still fail gracefully, but the shell, nav, and page structure
 * must render without crashing.
 */
test.describe("Signed-in navigation (fake-user seam)", () => {
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

  test("shell chrome renders for the fake user", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.getByRole("button", { name: /Color theme:/i })).toBeVisible({ timeout: 10_000 });
    // The shell shows the signed-in chrome: notifications, sign-out, create post.
    await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create Post/i })).toBeVisible();
  });

  test("core app routes render their page chrome without crashing", async ({ page }) => {
    const routes: Array<[string, RegExp]> = [
      ["/posts", /Feed/i],
      ["/projects", /Projects/i],
      ["/rooms", /Rooms/i],
      ["/events", /Events/i],
      ["/network", /Network/i],
      ["/mentors", /Mentors/i],
      ["/impact", /Impact/i],
      ["/badges", /Badges/i],
      ["/cas", /CAS/i],
      ["/settings", /Settings/i],
      ["/notifications", /Notifications/i],
      ["/documents", /Documents/i],
    ];
    for (const [route, expected] of routes) {
      await page.goto(route);
      await expect(page.getByText(expected).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("tool suite pages render their editors", async ({ page }) => {
    const routes: Array<[string, RegExp]> = [
      ["/tools", /All Tools/i],
      ["/tools/code", /Code Maker/i],
      ["/tools/design", /Designer/i],
      ["/tools/films", /Film Maker/i],
      ["/tools/tables", /Tables/i],
      ["/slideshows", /Slideshows/i],
    ];
    for (const [route, expected] of routes) {
      await page.goto(route);
      await expect(page.getByText(expected).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("page navigation does not throw console errors beyond expected 403s", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

    for (const route of ["/posts", "/projects", "/rooms", "/network"]) {
      await page.goto(route);
      await page.waitForTimeout(500);
    }

    // Only expected failures: backend data fetches (403/404/503) are fine.
    const unexpected = errors.filter((e) => !/403|404|503|Failed to fetch|NetworkError/i.test(e));
    expect(unexpected).toEqual([]);
  });
});
