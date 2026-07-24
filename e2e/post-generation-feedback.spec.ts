import { test, expect } from "@playwright/test";

/**
 * S-05 post-generation-feedback E2E.
 *
 * Phase 1 verification (steps 1.4 / 1.5):
 *   1.4 — POST /api/cv/generate response includes a UUID generationEventId.
 *          Tested by letting the REAL route run (no mock) and capturing the network
 *          response. Requires a running server with a configured OPENAI_API_KEY.
 *   1.5 — funnel_cv_generated PostHog event carries generation_event_id.
 *          The PostHog call goes server → eu.i.posthog.com and is not interceptable
 *          from the browser; this is covered by the unit test in
 *          src/pages/api/cv/generate.test.ts ("returns generationEventId …").
 *
 * Phase 4 feedback-widget tests follow below (added after Phase 3 UI lands).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe("Phase 1 — generate endpoint contract", () => {
  test("POST /api/cv/generate returns a UUID generationEventId in the 200 body (step 1.4)", async ({ page }) => {
    await page.goto("/cv/new");

    // Fill the two required fields on step 1.
    await page.getByLabel("What name should appear on your CV?").fill("P1 Verification");
    await page.getByLabel("What role, job, or direction are you aiming for?").fill("Software Engineer");

    // Navigate through the remaining steps without filling optional fields.
    await page.getByRole("button", { name: "Next" }).click(); // → experienceEducation
    await page.getByRole("button", { name: "Next" }).click(); // → skillsLanguages
    await page.getByRole("button", { name: "Next" }).click(); // → extraContext
    await page.getByRole("button", { name: "Review answers" }).click(); // → review

    // Trigger generation and capture the real route response.
    // Timeout is generous because the real OpenAI call can take up to ~25 s.
    const [generateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/cv/generate") && r.request().method() === "POST", {
        timeout: 35_000,
      }),
      page.getByRole("button", { name: "Generate draft" }).click(),
    ]);

    expect(generateResponse.status()).toBe(200);

    const body = (await generateResponse.json()) as { ok: boolean; generationEventId?: string };

    expect(body.ok).toBe(true);
    expect(typeof body.generationEventId).toBe("string");
    expect(body.generationEventId).toMatch(UUID_RE);

    // Step 1.5 note: the funnel_cv_generated PostHog event (server-side track() call) is
    // verified to carry generation_event_id in the unit test
    // `src/pages/api/cv/generate.test.ts > "returns generationEventId …"`.
    // It cannot be intercepted here because the call goes server → eu.i.posthog.com,
    // not through the browser.
  });
});
