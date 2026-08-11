import { test, expect } from "@playwright/test";

/**
 * R2 — "Unauthenticated user is redirected from protected routes".
 *
 * Risk: a broken middleware/cookie path would expose protected resources. This crosses
 * middleware → cookie resolution → redirect (src/middleware.ts PROTECTED_ROUTES). No mock:
 * the whole point is the real auth gate.
 *
 * Runs WITHOUT the shared storageState so the context is genuinely anonymous.
 *
 * Deliberate-break check (VERIFY): remove "/dashboard" from PROTECTED_ROUTES in
 * src/middleware.ts → this test must go red (no redirect) → revert. Never commit the break.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("anonymous visitor to a protected route lands on sign in", async ({ page }) => {
  await page.goto("/dashboard");

  await page.waitForURL("**/auth/signin");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("anonymous visitor to the CV builder lands on sign in", async ({ page }) => {
  await page.goto("/cv/new");

  await page.waitForURL("**/auth/signin");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
