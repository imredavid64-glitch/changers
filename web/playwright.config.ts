import { defineConfig, devices } from "@playwright/test";

/**
 * Signed-out smoke suite. Runs against the production-mode server so the app
 * is served without the dev HMR bootstrap (which the desktop preview webview
 * cannot complete reliably). With the minimal .env.local (no Appwrite /
 * DATABASE_URL), every page renders its signed-out state instantly.
 *
 * Local run (reuses the already-running preview on :3010):
 *   npm run test:e2e
 * CI run: a workflow job builds the app, starts `next start -p 3010`, and
 * Playwright's webServer reuses it (reuseExistingServer is off in CI so the
 * job's own server is used).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3010",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next start -p 3010",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
