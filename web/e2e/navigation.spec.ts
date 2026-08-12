import { expect, test } from "@playwright/test";

test.describe("Signed-out navigation smoke", () => {
  test("landing page renders the hero and key sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /change the world/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Four strands of change/i })).toBeVisible();
    await expect(page.getByText("Ready to start building?")).toBeVisible();
  });

  test("core routes render their signed-out state", async ({ page }) => {
    const routes: Array<[string, RegExp]> = [
      ["/messages", /Direct Messages/],
      ["/posts", /Feed/],
      ["/contact", /Send us a message/],
      ["/privacy", /Your data, on your terms/i],
      ["/sign-in", /Sign in/i],
      ["/sign-up", /Create/i],
    ];
    for (const [route, expected] of routes) {
      await page.goto(route);
      await expect(page.getByText(expected).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("unknown routes return a 404 page, not a crash", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-real-page");
    expect(response?.status()).toBe(404);
  });

  test("the spotlight card stays hidden when no spotlight is configured", async ({ page }) => {
    // No DATABASE_URL in the preview env, so the API returns null and the card
    // must not render (a pure progressive enhancement).
    await page.goto("/");
    await expect(page.getByText("Changer Spotlight")).toHaveCount(0);
    const api = await page.request.get("/api/spotlight");
    expect(api.status()).toBe(200);
    const body = (await api.json()) as { spotlight: unknown };
    expect(body.spotlight).toBeNull();
  });
});
