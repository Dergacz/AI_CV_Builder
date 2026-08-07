import { test, expect } from "@playwright/test";

/**
 * S-06 daily-generation-limit E2E (plan Phase 3).
 *
 * Risk: the server-authoritative wall never reaches the user. The gate can be correctly
 * wired server-side and still fail the person in front of it — the refusal falls back to
 * the generic outage copy, or the questionnaire drops the unfamiliar `daily_limit_reached`
 * bucket on the floor. That failure lives only in the rendered UI, at the end of a chain
 * (auth → routing → the real route → Postgres) that no unit test crosses.
 *
 * Boundaries: NOTHING is mocked — the whole point is that the real server refuses. This
 * spec runs under its own config (`playwright.quota.config.ts`, `npm run test:e2e:quota`),
 * against a dev server booted with `GENERATION_DAILY_LIMIT=0`, so `check_generation_quota`
 * returns `user_daily` on the first attempt. The gate sits before the OPENAI_API_KEY
 * check, so this needs no API key and spends nothing.
 *
 * Scope: with the limit pinned at 0 this proves the wall RENDERS and is localized — not
 * the counting arithmetic. Counting correctness is owned by the Phase 1 SQL verification
 * (`record_generation` bounds the ledger) and the Phase 2 route contract tests. Driving a
 * real 100-generation count through a browser would cost 100 OpenAI calls.
 *
 * Cleanup: none — a refused generation writes no ledger row and creates no CV.
 */

test("an over-limit user sees the daily-limit wall instead of a generated draft", async ({ page }) => {
  await page.goto("/cv/new");

  // Setup: the two required fields on step 1. Unique name so parallel runs never collide.
  await page.getByLabel("What name should appear on your CV?").fill(`Quota Wall ${Date.now()}`);
  await page.getByLabel("What role, job, or direction are you aiming for?").fill("Support Specialist");

  // Walk to the review step, leaving the optional fields empty.
  await page.getByRole("button", { name: "Next" }).click(); // → experienceEducation
  await page.getByRole("button", { name: "Next" }).click(); // → skillsLanguages
  await page.getByRole("button", { name: "Next" }).click(); // → extraContext
  await page.getByRole("button", { name: "Review answers" }).click(); // → review

  // Action: the real route refuses before any provider call.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/cv/generate") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Generate draft" }).click(),
  ]);

  expect(response.status()).toBe(429);
  expect((await response.json()) as { error: string }).toMatchObject({ error: "daily_limit_reached" });

  // Assertion: the user-visible outcome. The wall copy must appear — and must NOT degrade
  // to the generic outage message, which is the exact regression this test exists to catch.
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("You've reached today's CV generation limit. Please try again tomorrow.");
  await expect(alert).not.toContainText("temporarily unavailable");

  // The refusal is terminal for this attempt: no draft is rendered.
  await expect(page.getByRole("region", { name: "Generated CV draft" })).toBeHidden();
});
