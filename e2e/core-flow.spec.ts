import { statSync } from "node:fs";

import { test, expect } from "@playwright/test";
import { buildGeneratedDraftResponse } from "./fixtures/cv-draft";

/**
 * Core-flow happy-path + reachability (F-02, plan phase 4).
 *
 * Proves a normal verified user can still complete the entire funnel end-to-end:
 * questionnaire → generate (mocked) → edit a section → save → reopen (edit persists) →
 * export PDF (download). This is the reachability contract every future signup→app gate
 * (email verification, consent, daily-limit, Google auth) must preserve — if a gate
 * over-blocks or breaks any step, this spec goes red. The anonymous negative lives in
 * auth-redirect.spec.ts.
 *
 * Boundary: the external LLM is mocked at the app's own /api/cv/generate seam; auth, the
 * save API, Supabase, SSR, and the client-side PDF export all stay REAL.
 *
 * Deliberate-break checks (VERIFY, then revert):
 *  - make POST /api/cv skip the insert (or break the summary commit) → the reopen/edit
 *    assertion goes red.
 *  - make the export throw (e.g. break useCvExport) → the download assertion goes red.
 */
const createdCvIds: string[] = [];

test.afterEach(async ({ page }) => {
  for (const id of createdCvIds.splice(0)) {
    await page.request.delete(`/api/cv/${id}`);
  }
});

test("a verified user completes questionnaire → generate → edit → save → reopen → export", async ({ page }) => {
  const stamp = Date.now();
  const fullName = `Core Flow Tester ${stamp}`;
  const title = `Core Flow CV ${stamp}`;
  const editedSummary = `Edited summary ${stamp}`;

  // Mock only the nondeterministic generation result.
  await page.route("**/api/cv/generate", (route) => route.fulfill({ json: buildGeneratedDraftResponse() }));

  // Questionnaire → generate.
  await page.goto("/cv/new");
  await page.getByLabel("What name should appear on your CV?").fill(fullName);
  await page.getByLabel("What role, job, or direction are you aiming for?").fill("Customer support");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Generate draft" }).click();

  // Name the CV.
  await expect(page.getByLabel("CV title")).toBeVisible();
  await page.getByLabel("CV title").fill(title);

  // Edit a section: open the summary editor (the first section's "Edit" button — exact, so
  // it does not match "Edit answers"), change the body, save the section.
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  const summaryEditor = page.getByRole("region", { name: "Edit Summary" });
  await expect(summaryEditor).toBeVisible();
  await summaryEditor.getByLabel("Summary").fill(editedSummary);
  await summaryEditor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(summaryEditor).toBeHidden();

  // Save the whole CV (real POST /api/cv → Supabase).
  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/cv") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Save", exact: true }).click(),
  ]);
  const { cv } = (await saveResponse.json()) as { cv: { id: string } };
  createdCvIds.push(cv.id);

  // Reopen: the title, the full name, and the edited summary all survive the round-trip + SSR.
  await page.goto(`/cv/${cv.id}`);
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();
  await expect(page.getByText(editedSummary)).toBeVisible();

  // Export: the real client-side PDF export triggers a non-empty .pdf download.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const downloadPath = await download.path();
  expect(statSync(downloadPath).size).toBeGreaterThan(0);

  // Cleanup.
  await page.request.delete(`/api/cv/${cv.id}`);
  createdCvIds.splice(createdCvIds.indexOf(cv.id), 1);
});
