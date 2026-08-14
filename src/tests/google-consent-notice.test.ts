import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * R-18: a Google account may never be created without a consent record, and the user must be able
 * to read what they are consenting to at the moment they consent.
 *
 * Asserted statically, on the component source, for the same reason `auth-google-availability.test.ts`
 * asserts statically on the page source: this repo has NO React rendering stack. There is no
 * `@testing-library/react`, no jsdom or happy-dom, no `environment` in `vitest.config.ts`, and the
 * discovery glob is `src/**\/*.test.ts` — a `.test.tsx` would not even be collected. Standing that
 * up for one component is a larger change than the component itself.
 *
 * What this file pins is the structure no other layer can see: the checkbox gate is gone (so the
 * form cannot reintroduce a client-side block), the notice copy is rendered, and both policy links
 * are present. Whether it *looks* right is manual verification; that the click reaches the provider
 * is `e2e/oauth-google.spec.ts`; that the cookie is always set is
 * `src/tests/api/auth-oauth-google.test.ts`.
 */

const source = readFileSync(
  fileURLToPath(new URL("../components/auth/GoogleSignInButton.tsx", import.meta.url)),
  "utf8",
);

describe("GoogleSignInButton consent notice", () => {
  it("no longer renders a consent checkbox", () => {
    // Both the import and the element — a stray import alone would be dead code, but the element
    // returning is the regression that matters.
    expect(source).not.toContain("ConsentCheckbox");
  });

  it("holds no consent state and no submit gate", () => {
    // useState here could only exist to re-gate the click; the notice needs no state at all.
    expect(source).not.toContain("useState");
    expect(source).not.toContain("preventDefault");
  });

  it("renders the notice from the Google consent copy, not the signup form's", () => {
    expect(source).toContain("auth.google");
    expect(source).toContain("copy.consent.prefix");
    expect(source).toContain("copy.consent.termsLabel");
    expect(source).toContain("copy.consent.privacyLabel");
    // The signup form's checkbox copy lives under a different path; reusing it would couple the
    // sign-in page to sign-up wording and reintroduce first-person "I agree" phrasing.
    expect(source).not.toContain("auth.form.signup");
  });

  it("links both policies from inside the notice", () => {
    expect(source).toContain('href="/terms"');
    expect(source).toContain('href="/privacy"');
  });

  it("associates the notice with the button for screen readers", () => {
    expect(source).toContain("aria-describedby");
  });

  it("posts to the OAuth start endpoint without an intent field", () => {
    expect(source).toContain('action="/api/auth/oauth/google"');
    // The endpoint no longer reads `intent`; a hidden field would falsely imply it distinguishes
    // the two pages.
    expect(source).not.toContain('name="intent"');
  });
});
