import { test, expect } from "@playwright/test";

/**
 * S-09 — "Legal pages resolve and every entry point navigates to them".
 *
 * Risk: the consent gate links and the global footer point at /terms and /privacy;
 * a missing page or a mis-wired link would 404 the user out of a legally required
 * document. This crosses routing (src/pages/{terms,privacy}.astro), the consent
 * checkbox links (src/components/auth/ConsentCheckbox.tsx), and the global footer
 * (src/components/Footer.astro via src/layouts/Layout.astro). No mock — the pages
 * are public SSR and the whole point is that they really resolve.
 *
 * Runs anonymously: the legal pages are public, so no auth/storageState is needed.
 * No assertions on legal body wording — the documents are a pending-review draft.
 *
 * Deliberate-break check (VERIFY): rename src/pages/terms.astro → this test must go
 * red (no heading / 404) → revert. Never commit the break.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("the legal pages resolve directly", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
});

test("the signup consent links navigate to the legal pages", async ({ page }) => {
  await page.goto("/auth/signup");

  // Consent links live in <main>; the footer carries identically-named links, so scope to main.
  await page.getByRole("main").getByRole("link", { name: "Terms of Service" }).click();
  await page.waitForURL("**/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();

  await page.goto("/auth/signup");
  await page.getByRole("main").getByRole("link", { name: "Privacy Policy" }).click();
  await page.waitForURL("**/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
});

test("the global footer links navigate to the legal pages", async ({ page }) => {
  await page.goto("/auth/signin");

  // Footer is the <footer> landmark (role contentinfo); scope to it to avoid other links.
  await page.getByRole("contentinfo").getByRole("link", { name: "Terms of Service" }).click();
  await page.waitForURL("**/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();

  await page.goto("/auth/signin");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" }).click();
  await page.waitForURL("**/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
});
