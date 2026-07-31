import { test, expect, type Page } from "@playwright/test";

import { buildGeneratedDraftResponse } from "./fixtures/cv-draft";

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
 * Phase 4 covers the widget itself. Boundaries: generation is mocked at the app's own
 * seam (it runs server-side — see e2e/README.md), and /api/cv/feedback is mocked so the
 * assertions read the posted body directly instead of round-tripping through Supabase.
 * The React island, its wiring to the generate response, and the fail-soft path are all
 * real. Nothing is saved or persisted here, so there is nothing to clean up.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mockGenerateResponse = buildGeneratedDraftResponse();
const MOCK_GENERATION_EVENT_ID = mockGenerateResponse.ok ? mockGenerateResponse.generationEventId : "";

/** Drive the questionnaire to a generated draft with generation mocked. */
async function generateDraft(page: Page, fullName: string) {
  await page.route("**/api/cv/generate", (route) => route.fulfill({ json: buildGeneratedDraftResponse() }));

  await page.goto("/cv/new");
  await page.getByLabel("What name should appear on your CV?").fill(fullName);
  await page.getByLabel("What role, job, or direction are you aiming for?").fill("Support Specialist");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Review answers" }).click();
  await page.getByRole("button", { name: "Generate draft" }).click();

  await expect(page.getByRole("region", { name: "Generated CV draft" })).toBeVisible();
}

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

test.describe("Phase 4 — feedback widget", () => {
  test("submits the verdict and comment for the generated draft, then confirms", async ({ page }) => {
    const fullName = `Feedback Submit ${Date.now()}`;
    await generateDraft(page, fullName);

    const widget = page.getByRole("region", { name: "Draft feedback" });
    await expect(widget).toBeVisible();
    await expect(widget.getByRole("heading", { name: "Was this draft helpful?" })).toBeVisible();

    // Mock the endpoint so the assertion reads the posted body rather than the DB.
    await page.route("**/api/cv/feedback", (route) => route.fulfill({ json: { ok: true } }));

    await widget.getByRole("button", { name: "Helpful", exact: true }).click();

    const comment = `Clear summary section ${Date.now()}`;
    await widget.getByLabel("Tell us more (optional)").fill(comment);

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/cv/feedback") && r.method() === "POST"),
      widget.getByRole("button", { name: "Send feedback" }).click(),
    ]);

    // The widget must send the id minted by generation — never a CV id, never draft content.
    expect(request.postDataJSON()).toEqual({
      generationEventId: MOCK_GENERATION_EVENT_ID,
      helpful: true,
      comment,
    });

    await expect(widget.getByRole("status")).toHaveText("Thanks — your feedback was recorded.");
  });

  test("sends a Not-helpful verdict without a comment", async ({ page }) => {
    await generateDraft(page, `Feedback No Comment ${Date.now()}`);

    const widget = page.getByRole("region", { name: "Draft feedback" });
    await page.route("**/api/cv/feedback", (route) => route.fulfill({ json: { ok: true } }));

    await widget.getByRole("button", { name: "Not helpful" }).click();

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/cv/feedback") && r.method() === "POST"),
      widget.getByRole("button", { name: "Send feedback" }).click(),
    ]);

    expect(request.postDataJSON()).toEqual({
      generationEventId: MOCK_GENERATION_EVENT_ID,
      helpful: false,
    });

    await expect(widget.getByRole("status")).toBeVisible();
  });

  test("surfaces an inline retry when the submit fails, without blocking save or export", async ({ page }) => {
    await generateDraft(page, `Feedback Failure ${Date.now()}`);

    const widget = page.getByRole("region", { name: "Draft feedback" });
    await page.route("**/api/cv/feedback", (route) =>
      route.fulfill({ status: 500, json: { ok: false, error: "feedback_failed", message: "nope" } }),
    );

    await widget.getByRole("button", { name: "Helpful", exact: true }).click();
    await widget.getByRole("button", { name: "Send feedback" }).click();

    await expect(widget.getByRole("alert")).toHaveText("We couldn't send your feedback. Please try again.");
    await expect(widget.getByRole("status")).toBeHidden();

    // Fail-soft: the rest of the editor stays usable after a failed submit.
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Export PDF" })).toBeEnabled();
  });
});
