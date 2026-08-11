import { test as setup, expect } from "@playwright/test";
import { TEST_USER } from "./fixtures/test-user";

const authFile = "playwright/.auth/user.json";

/**
 * Logs in once and saves the session for every feature spec (Playwright storageState
 * pattern). Idempotent: signs in if the account exists, else signs up. Local Supabase
 * auto-confirms (`enable_confirmations = false`), so signup yields an immediate session.
 */
setup("authenticate", async ({ page }) => {
  await page.goto("/auth/signin");
  await page.getByLabel("Email").fill(TEST_USER.email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|auth\/signin)/);

  if (!page.url().includes("/dashboard")) {
    // First run on a clean DB: create the durable test account.
    await page.goto("/auth/signup");
    await page.getByLabel("Email").fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_USER.password);
    await page.getByLabel("Confirm password").fill(TEST_USER.password);
    // Consent gate (consent-gated-registration) makes this checkbox required for signup.
    // S-04 added a second, identically-labelled consent checkbox for the Google button, so
    // scope to the email/password form by its action contract (see e2e/README.md).
    const signUpForm = page.locator('form[action="/api/auth/signup"]');
    await signUpForm.getByRole("checkbox").check();
    await signUpForm.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/dashboard");
  }

  // Prove we're authenticated before persisting the session.
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
