# Google Consent Notice — Plan Brief

> Full plan: `context/changes/google-consent-notice/plan.md`

## What & Why

The consent checkbox attached to the "Continue with Google" button is replaced by an inline notice —
clicking the button becomes the act of acceptance. Beyond the UX simplification this closes a
production dead-end: a first-time visitor clicking Google on `/auth/signin` completes the entire
OAuth round-trip and is then signed out and bounced to `/auth/signup?error=consent_required`,
because the signin path never set the consent cookie.

## Starting Point

Consent is enforced at three points: a client-side `preventDefault` inside the button island, a
server gate in `/api/auth/oauth/google` that rejects an unconsented signup-intent POST, and a
fail-closed branch in `/auth/callback` that signs out any brand-new account arriving without a
consent cookie. The start endpoint sets that cookie **only** when `intent === "signup"`, which is
what makes the third point fire for ordinary sign-in-page users rather than staying the safety net
it was written to be.

## Desired End State

Both auth pages show a bare Google button with a short notice beneath it — "By continuing, you agree
to the Terms of Service and Privacy Policy", both names linking to `/terms` and `/privacy`. The
consent cookie is set on every Google start, so a new account reaches `/dashboard` with
`consent_version` stamped on its metadata. No user-visible path creates a Google account without a
consent record. The email signup form keeps its own checkbox.

## Key Decisions Made

| Decision              | Choice                                   | Why (1 sentence)                                                                                                |
| --------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Consent mechanism     | Inline notice, click = consent           | Standard pattern; keeps the policy links in front of the user while removing the extra step.                    |
| Server consent gate   | Removed; cookie set unconditionally      | A gate checking a field we always send would be theatre and would mislead the next reader.                      |
| Callback fail-closed  | Left exactly as is                       | It becomes a genuine safety net once the cookie is always set — no account enters without a consent record.     |
| Notice placement      | Under the button, both pages             | Keeps consent adjacent to the action expressing it and the component self-contained.                            |
| Email signup checkbox | Untouched                                | Out of scope; widening to it would pull in validation, the signup API and the email funnel's E2E.               |
| `intent` field        | Removed end-to-end                       | Nothing reads it once the gate is gone; leaving it would falsely signal the route distinguishes the two paths.  |
| Copy shape            | New `auth.google.consent` fragment block | Keeps the sign-in page independent of signup-form copy and lands under the existing locale-parity test (R-08).  |
| Component test        | Static source assertion                  | The repo has no React rendering stack at all; `auth-google-availability.test.ts` is the precedent.              |
| Component stays React | Yes, for now                             | It ends up stateless and arguably belongs in `.astro`, but converting widens the diff for no user-visible gain. |
| E2E second spec       | Rewritten, not deleted                   | Keeps a guard on the signup page specifically, where a regression would otherwise pass unnoticed.               |

## Scope

**In scope:** `GoogleSignInButton.tsx`, `/api/auth/oauth/google.ts`, both auth pages, the
`auth.google.consent` copy in three locales, the route tests, a new component structure test, the
rewritten E2E spec, an R-18 risk row, README.

**Out of scope:** the email signup form and its validation/API/E2E; converting the button to
`.astro`; removing the `consent_required` error code; re-prompting existing accounts; any schema or
env-var change.

## Architecture / Approach

Four phases ordered so the tree is never broken. Copy lands first (additive, unconsumed). Then the
**server relaxes before the client stops sending**: phase 2 makes the route ignore `consent` and
`intent` while the old form still submits them — a no-op for users — and phase 3 strips the fields
from the form. The reverse order would open a window where the form sends no `intent`, the route
defaults it to `"signin"`, the cookie is never set, and every new Google signup hits the fail-closed
branch. Phase 4 collects the cross-cutting coverage.

## Phases at a Glance

| Phase                        | What it delivers                                        | Key risk                                                                |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1. Consent-notice copy       | `auth.google.consent` in en/pl/ru                       | Missing a locale — caught automatically by the R-08 parity test.        |
| 2. Start endpoint relaxed    | Cookie set on every start; dead-end closed              | Cookie must still not be set when the provider is unconfigured.         |
| 3. Button: checkbox → notice | Stateless island, notice with policy links, no `intent` | Locale copy or link targets wrong; caught manually and by phase 4.      |
| 4. E2E, risk register, docs  | Rewritten spec, R-18 row, README note                   | The rewritten spec asserts the new behavior without really guarding it. |

**Prerequisites:** local Supabase (`npm run db:start`) for the E2E gate, and a Google account that
has never used the app for the phase-2 manual check.
**Estimated effort:** ~1 session across 4 phases; phases 1 and 2 are small.

## Open Risks & Assumptions

- Consent expressed by clicking a button is weaker than an explicit affirmative act under a strict
  GDPR reading. Raised during planning and accepted deliberately.
- `OBSERVABILITY_ID_SALT` signs the consent cookie and fails closed. It is set in the production
  Worker today (verified via `wrangler secret list`); if it were ever removed, every new Google
  signup would dead-end with the same symptom this change fixes. Phase 4 documents it.
- The signup page will carry two different consent idioms — a checkbox for email, a notice for
  Google. Accepted as the cost of keeping the change narrow.

## Success Criteria (Summary)

- A first-time user can sign in with Google from `/auth/signin` and land on `/dashboard`, with no
  checkbox anywhere in the Google flow.
- Every Google-created account still carries `consent_version` in its metadata.
- The policy links stay visible and reachable at the moment of consent, in all three locales.
