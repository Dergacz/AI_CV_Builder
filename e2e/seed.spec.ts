import { test, expect } from "@playwright/test";
import { buildGeneratedDraftResponse } from "./fixtures/cv-draft";

/**
 * SEED TEST — the exemplar every generated E2E test is modeled on (10xDevs M3L4).
 *
 * It demonstrates the four quality patterns, on this app's real flow:
 *  1. Role/label locators (getByRole / getByLabel) — never CSS/XPath.
 *  2. Wait for STATE, not time (waitForResponse / toBeVisible) — never waitForTimeout.
 *  3. Unique ids (Date.now suffix) so parallel runs and re-runs never collide.
 *  4. One independent cycle: setup → action → assertion → cleanup, with a risk-tied name.
 *
 * Boundary: the external LLM is mocked at the app's own /api/cv/generate seam (generation
 * runs server-side, so the OpenAI URL is not browser-interceptable); auth + save + DB stay real.
 */
test("saved CV reopens with its persisted content after a fresh navigation", async ({ page }) => {
  const stamp = Date.now();
  const fullName = `Seed Tester ${stamp}`;
  const title = `Seed CV ${stamp}`;

  // Mock only the nondeterministic generation result.
  await page.route("**/api/cv/generate", (route) => route.fulfill({ json: buildGeneratedDraftResponse() }));

  // Setup + action: walk the questionnaire and generate a draft.
  await page.goto("/cv/new");
  await page.getByLabel("What name should appear on your CV?").fill(fullName);
  await page.getByLabel("What role, job, or direction are you aiming for?").fill("Customer support");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Generate draft" }).click();

  // Name the draft and save it (real POST /api/cv → Supabase).
  await expect(page.getByLabel("CV title")).toBeVisible();
  await page.getByLabel("CV title").fill(title);
  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/cv") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const { cv } = (await saveResponse.json()) as { cv: { id: string } };

  // Assertion: reopening the saved CV shows the persisted content (DB round-trip + SSR).
  await page.goto(`/cv/${cv.id}`);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();

  // Cleanup: remove the CV this test created (shares the authenticated session).
  await page.request.delete(`/api/cv/${cv.id}`);
});
