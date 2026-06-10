import { test, expect } from "@playwright/test";
import { buildGeneratedDraftResponse } from "./fixtures/cv-draft";

/**
 * R1 — "Generated CV persists after a page reload".
 *
 * Risk: a CV the user generated and saved is lost on refresh — the data never survives
 * auth → save API → Supabase → SSR. This is the canonical browser-level risk: no unit test
 * covers the full path.
 *
 * Boundaries: the external LLM is mocked at the app's own /api/cv/generate seam (generation
 * runs server-side, so the OpenAI URL is not browser-interceptable). Auth, the save API, the
 * database, and the dashboard's server render all stay REAL — that is exactly what R1 guards.
 *
 * Deliberate-break check (VERIFY): make POST /api/cv a no-op (or have it skip the insert) in
 * src/pages/api/cv/index.ts → this test must go red (CV absent after reload) → revert.
 */
const createdCvIds: string[] = [];

test.afterEach(async ({ page }) => {
  // Safety net on top of in-test cleanup: drop anything left behind even if a test failed early.
  for (const id of createdCvIds.splice(0)) {
    await page.request.delete(`/api/cv/${id}`);
  }
});

test("a generated CV is still in the library after reloading the dashboard", async ({ page }) => {
  const stamp = Date.now();
  const title = `Persisted CV ${stamp}`;

  await page.route("**/api/cv/generate", (route) => route.fulfill({ json: buildGeneratedDraftResponse() }));

  // Generate a draft through the questionnaire.
  await page.goto("/cv/new");
  await page.getByLabel("What name should appear on your CV?").fill(`Persist Tester ${stamp}`);
  await page.getByLabel("What role, job, or direction are you aiming for?").fill("Customer support");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Generate draft" }).click();

  // Save it (real persistence path).
  await expect(page.getByLabel("CV title")).toBeVisible();
  await page.getByLabel("CV title").fill(title);
  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/cv") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const { cv } = (await saveResponse.json()) as { cv: { id: string } };
  createdCvIds.push(cv.id);
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  // The risk: does it SURVIVE a reload? Assert against the freshly server-rendered library.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Cleanup.
  await page.request.delete(`/api/cv/${cv.id}`);
  createdCvIds.splice(createdCvIds.indexOf(cv.id), 1);
});
