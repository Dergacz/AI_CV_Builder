import { test, expect } from "@playwright/test";

/**
 * "Continue with Google" renders on both auth pages, states what the click consents to, and hands
 * off to the OAuth provider on the first click.
 *
 * Risk (R-17, R-18): a regression silently drops the Google button from an auth page, or the button
 * stops handing off to the provider, or the consent notice disappears — leaving a click that
 * creates an account with nothing telling the user what they agreed to. None of that is visible to
 * a unit test: it lives in the rendered island (mounted `client:only`, so absent from SSR output)
 * and at the UI → start endpoint → 303 → provider authorize boundary.
 *
 * Real vs mocked: the page, the React island, and the real POST to /api/auth/oauth/google (which
 * runs signInWithOAuth server-side) all stay REAL — that's the boundary under test. We mock only
 * the provider hop at Supabase's /auth/v1/authorize seam so the test never reaches real Google;
 * the request the browser makes there is the proof the redirect was initiated. No session or
 * account is created (we stop before the provider), so there is nothing to clean up.
 *
 * Locators: the Google form is scoped by its action contract (the POST target) rather than by role,
 * so the signup page's own email-form consent checkbox can never be mistaken for something inside
 * it — which is exactly what the "no checkbox" assertion below needs to be able to distinguish.
 *
 * Deliberate-break check (VERIFY): in GoogleSignInButton.tsx delete the `<p>` notice (or its
 * `/terms` anchor) → the signup notice assertion must go red → revert. Never commit the break.
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

  const googleButton = page.getByRole("button", { name: /Google/ });
  await expect(googleButton).toBeVisible();

  // The notice appears here too: a click from the sign-in page creates an account just as readily,
  // so this is the page where consent used to be silently skipped.
  await expect(page.locator(GOOGLE_FORM).getByText(/By continuing, you agree to the/i)).toBeVisible();

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

test("Google button on sign up states the consent inline and hands off on the first click", async ({ page }) => {
  await stubProviderHandoff(page);

  await page.goto("/auth/signup");

  const googleForm = page.locator(GOOGLE_FORM);
  const googleButton = googleForm.getByRole("button", { name: /Google/ });
  await expect(googleButton).toBeVisible();

  // No checkbox inside the Google form — the click itself is the consent. The signup page still has
  // one for its email form, which is why this is scoped to the Google form rather than the page.
  await expect(googleForm.getByRole("checkbox")).toHaveCount(0);

  // The user must be able to read what the click commits them to, and reach both documents.
  await expect(googleForm.getByText(/By continuing, you agree to the/i)).toBeVisible();
  await expect(googleForm.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  await expect(googleForm.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");

  // The FIRST click starts OAuth — no intermediate gate to satisfy.
  const [authorizeRequest] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/auth/v1/authorize")),
    googleButton.click(),
  ]);

  const authorizeUrl = new URL(authorizeRequest.url());
  expect(authorizeUrl.searchParams.get("provider")).toBe("google");
  expect(authorizeUrl.searchParams.get("redirect_to")).toContain("/auth/callback");
});
