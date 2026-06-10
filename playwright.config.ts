import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration (10xDevs M3L4).
 *
 * - DOM/snapshot mode is the default per CLAUDE.md; vision is not used here.
 * - `setup` project logs in once and writes storageState; feature specs reuse it,
 *   so they start authenticated and never depend on the login UI.
 * - The dev server is booted automatically and pinned to port 4321 for a stable
 *   baseURL. Targets local Supabase (127.0.0.1:54321) for real auth + DB.
 */
const PORT = 4321;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    // Logs in once, persists session to playwright/.auth/user.json.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
