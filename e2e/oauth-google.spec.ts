import { test, expect } from "@playwright/test";

/**
 * Phase 5 — "Continue with Google" buttons render and clicking initiates the OAuth redirect.
 *
 * Risk (plan.md Phase 5 / desired end state): a regression silently drops the Google button
 * from an auth page, or the button stops handing off to the provider, or the signup consent
 * gate stops blocking submit — none of which a unit test sees, because they live only in the
 * rendered island (client-side consent validation) and the UI → start endpoint → 303 → provider
 * authorize boundary.
 *
 * Real vs mocked: the page, the React island, and the real POST to /api/auth/oauth/google (which
 * runs signInWithOAuth server-side) all stay REAL — that's the boundary under test. We mock only
 * the provider hop at Supabase's /auth/v1/authorize seam so the test never reaches real Google;
 * the request the browser makes there is the proof the redirect was initiated. No session or
 * account is created (we stop before the provider), so there is nothing to clean up.
 *
 * Locators: the signup page renders TWO consent checkboxes with identical name/label (SignUpForm's
 * own + the Google button's), so role/label are ambiguous there — we scope to the Google form by
 * its action contract (the POST target), then use role locators within it.
 *
 * Deliberate-break check (VERIFY): in GoogleSignInButton.tsx drop the `e.preventDefault()` in
 * handleSubmit → the signup "blocked until consent" assertion must go red (the form submits without
 * consent) → revert. Never commit the break.
 *
 * Runs anonymous (these are pre-auth pages) — opt out of the shared storageState.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const GOOGLE_FORM = 'form[action="/api/auth/oauth/google"]';

/** Stop the OAuth chain at the Supabase authorize hop so the test never reaches real Google. */
async function stubProviderHandoff(page: import("@playwright/test").Page) {
  await page.route("**/auth/v1/authorize**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>oauth-provider-handoff</body></html>" }),
  );
}

test("Google button on sign in hands off to the OAuth provider", async ({ page }) => {
  await stubProviderHandoff(page);

  await page.goto("/auth/signin");

  // The button is present on the sign-in card (bare — no consent affordance).
  const googleButton = page.getByRole("button", { name: /Google/ });
  await expect(googleButton).toBeVisible();

  // Clicking initiates the real start endpoint, which redirects the browser toward the provider.
  const [authorizeRequest] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/auth/v1/authorize")),
    googleButton.click(),
  ]);

  // The handoff targets Google and points back at our callback — the cross-boundary contract.
  const authorizeUrl = new URL(authorizeRequest.url());
  expect(authorizeUrl.searchParams.get("provider")).toBe("google");
  expect(authorizeUrl.searchParams.get("redirect_to")).toContain("/auth/callback");
});

test("Google button on sign up is blocked until consent, then hands off to the provider", async ({ page }) => {
  await stubProviderHandoff(page);

  await page.goto("/auth/signup");

  const googleForm = page.locator(GOOGLE_FORM);
  const googleButton = googleForm.getByRole("button", { name: /Google/ });
  await expect(googleButton).toBeVisible();

  // Clicking without consent must NOT start OAuth: the client gate blocks submit and surfaces an error.
  await googleButton.click();
  await expect(googleForm.getByText(/accept the Terms of Service and Privacy Policy/i)).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/signup/);

  // Once consent is given, the same click initiates the provider handoff.
  await googleForm.getByRole("checkbox").check();
  const [authorizeRequest] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/auth/v1/authorize")),
    googleButton.click(),
  ]);

  const authorizeUrl = new URL(authorizeRequest.url());
  expect(authorizeUrl.searchParams.get("provider")).toBe("google");
  expect(authorizeUrl.searchParams.get("redirect_to")).toContain("/auth/callback");
});
