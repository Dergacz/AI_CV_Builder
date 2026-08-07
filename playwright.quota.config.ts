import { defineConfig, devices } from "@playwright/test";

/**
 * Quota-limited E2E configuration (S-06 / FR-012).
 *
 * `e2e/daily-generation-limit.spec.ts` has to drive a server whose daily quota is exhausted from
 * the very first request. The shared server on 4321 must keep normal limits — the real-generation
 * spec (`e2e/post-generation-feedback.spec.ts`) expects a 200 there — so the wall spec needs its
 * own server, here on 4322 with `GENERATION_DAILY_LIMIT=0`.
 *
 * Why a separate config rather than a second `webServer` entry in playwright.config.ts: two Astro
 * dev servers booting together contend for CPU badly enough that the first on-demand compile of
 * unrelated routes (/terms, /privacy) blew the 30 s test timeout on a cold cache — reproducibly,
 * twice, and giving them separate Vite cache dirs did not help. Separate configs run sequentially,
 * so the two servers never overlap and the existing suite keeps its original timing.
 *
 * Auth carries over for free: the `setup` project logs in against this server, and cookies are not
 * port-scoped, so the same storageState file serves both configs. Both talk to the same local
 * Supabase.
 */
const PORT = 4322;
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
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testMatch: /daily-generation-limit\.spec\.ts/,
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
    // The one lever the spec needs: refuse every generation on the first attempt. A limit of 0 is
    // honoured deliberately (see positiveIntOr in src/lib/services/generation-quota.ts).
    env: { GENERATION_DAILY_LIMIT: "0" },
  },
});
