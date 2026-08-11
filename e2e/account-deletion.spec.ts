import { expect, test } from "@playwright/test";

import { TEST_USER } from "./fixtures/test-user";

/**
 * R-14 — "The account-deletion confirmation gate stops letting through only the account owner".
 *
 * This is the one control in the product standing between a user and irreversible loss of
 * everything they have. The gate spans page → island → shared `confirmationMatches` → dialog
 * state, and only the browser shows whether the confirm button is really reachable.
 *
 * NON-DESTRUCTIVE BY CONSTRUCTION. The suite shares one storageState account
 * (`e2e/auth.setup.ts`); a spec that actually confirmed would delete that account and poison
 * every other spec in the run — and, unlike a CV, nothing could recreate its history. So:
 *
 *   - no test clicks "Delete everything"; each one ends on Cancel or Escape, and
 *   - `beforeEach` aborts any request to `/api/account/delete`, so even a future edit that
 *     added the click could not reach the server.
 *
 * Real deletion is proven at the layers where it is safe: the cascade by pgTAP
 * (`supabase/tests/database/account_deletion_cascade.test.sql`), the route contract by unit
 * tests, and the end-to-end path by the manual walkthrough in the S-08 plan.
 *
 * PREREQUISITE: `SUPABASE_SECRET_KEY` must be set in `.dev.vars` (see `.env.example`).
 * Without it `/account` renders the honest "temporarily unavailable" state and there is no
 * delete button to test — the assertion below says so rather than timing out anonymously.
 *
 * Deliberate-break check (VERIFY): make `confirmDisabled` in `DeleteAccountPanel.tsx` ignore
 * `matches` → the wrong-email test must go red → revert. Never commit the break.
 */

test.beforeEach(async ({ page }) => {
  await page.route("**/api/account/delete", (route) => route.abort());
});

test("the danger zone spells out what deletion removes", async ({ page }) => {
  await page.goto("/account");

  const dangerZone = page.getByRole("region", { name: "Danger zone" });
  await expect(dangerZone).toBeVisible();
  await expect(dangerZone.getByText("every saved CV and its questionnaire answers")).toBeVisible();
  await expect(
    dangerZone.getByRole("button", { name: "Delete account" }),
    "no delete button — is SUPABASE_SECRET_KEY set in .dev.vars? Without it /account renders the unavailable state.",
  ).toBeVisible();
});

test("confirm stays disabled until the typed address is the account address", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Delete account" }).click();

  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Delete everything" });
  const emailField = dialog.getByLabel("Your email address");

  // Empty field.
  await expect(confirm).toBeDisabled();

  // A different, well-formed address — the near-miss that matters, since a user with two
  // accounts could plausibly type the other one.
  await emailField.fill(`not-${TEST_USER.email}`);
  await expect(confirm).toBeDisabled();

  // The account address, with the casing and padding the shared gate is supposed to forgive.
  await emailField.fill(`  ${TEST_USER.email.toUpperCase()}  `);
  await expect(confirm).toBeEnabled();

  // Deliberately NOT clicking confirm — see the file header.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("cancel closes the dialog and returns focus to the trigger", async ({ page }) => {
  await page.goto("/account");

  const trigger = page.getByRole("button", { name: "Delete account" });
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("escape closes the dialog without deleting", async ({ page }) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Delete account" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your email address").fill(TEST_USER.email);
  await expect(dialog.getByRole("button", { name: "Delete everything" })).toBeEnabled();

  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  // Still signed in and still on /account: nothing was deleted, nothing was signed out.
  await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an anonymous visitor cannot reach the account page", async ({ page }) => {
    await page.goto("/account");

    await page.waitForURL("**/auth/signin");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});
