import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    // Node 18 @types: run one file per worker to avoid module-level state bleed.
    pool: "forks",
    fileParallelism: false,
    // Generous timeouts for tests that re-import deep module trees (sharp, pg, appwrite).
    hookTimeout: 60_000,
    testTimeout: 30_000,
    include: ["lib/**/*.test.ts", "app/api/**/*.test.ts", "components/**/*.test.tsx"],
    // Minimal Appwrite config so the server modules can run their fetch logic
    // against a mocked global fetch (see the test files).
    env: {
      APPWRITE_API_KEY: "test-server-key",
      NEXT_PUBLIC_APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: "test-project",
      NEXT_PUBLIC_APPWRITE_DATABASE_ID: "test-db",
    },
  },
});
