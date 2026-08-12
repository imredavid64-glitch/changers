import { expect, test } from "@playwright/test";

test.describe("Search page", () => {
  test("renders results state and category filters", async ({ page }) => {
    await page.goto("/search?q=plastic");
    await expect(page.getByRole("heading", { name: /Search Results/i })).toBeVisible();
    await expect(page.getByText(/Found \d+ results for "plastic"/i)).toBeVisible();

    const filters = ["All", "People", "Posts", "Projects", "Events", "Rooms", "Tools"];
    for (const filter of filters) {
      await expect(page.getByRole("button", { name: filter, exact: true })).toBeVisible();
    }
  });

  test("explains that search is unavailable without the backend configured", async ({ page }) => {
    // With the minimal env, a query shows the derived configuration message
    // instead of silently appearing broken.
    await page.goto("/search?q=plastic");
    await expect(page.getByText(/Add your Appwrite website environment variables to enable search/i)).toBeVisible();
  });
});
