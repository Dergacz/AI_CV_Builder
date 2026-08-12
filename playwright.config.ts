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
  // S-06's wall spec needs a server booted with the quota exhausted, which this one must NOT be —
  // post-generation-feedback.spec.ts makes a real generation call here and expects a 200. It runs
  // from playwright.quota.config.ts instead; see that file for why it isn't a second webServer.
  testIgnore: /daily-generation-limit\.spec\.ts/,
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
    // A SIGNAL, not a credential. The app reads only this variable's presence to decide whether the
    // Google button renders at all (R-17, src/lib/auth/google-provider.ts), so oauth-google.spec.ts
    // would find no button on a machine without Google credentials. The spec never reaches real
    // Google — it stubs the provider hop at **/auth/v1/authorize — so any non-empty value serves.
    //
    // Precedence, measured rather than assumed: `.dev.vars` WINS over the process environment under
    // the Cloudflare adapter's dev server. So this line is what makes the spec pass on a machine
    // with no Google credentials, and it is inert on a machine whose `.dev.vars` already sets the
    // variable. Either way the button renders — which is all the spec needs. The same applies to
    // GENERATION_DAILY_LIMIT in playwright.quota.config.ts, which no `.dev.vars` defines.
    env: { SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: "e2e-google-client-id" },
  },
});
