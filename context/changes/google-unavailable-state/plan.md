# Google Sign-In Unavailable State Implementation Plan

## Overview

"Continue with Google" renders unconditionally on both auth pages, but the app has no idea whether Supabase's Google provider is actually enabled. On a deployment without Google credentials the button is a guaranteed dead end: clicking it hands the browser to Supabase's `/authorize`, which rejects with "Unsupported provider" outside our app entirely.

This change gives the app a server-side availability signal and makes the surface degrade honestly — the same treatment `/account` already gives account deletion when `SUPABASE_SECRET_KEY` is absent.

## Current State Analysis

Google sign-in shipped complete in `google-signin-linking`: button → `POST /api/auth/oauth/google` → Google → `/auth/callback` → `/dashboard`, with consent gating and auto-linking. What it did not ship is a configured-or-not signal.

- **The credentials live outside the app.** `supabase/config.toml:333-337` sets `enabled = true` with `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`; production sets the same pair in the hosted dashboard (README:217). Neither var appears in `astro.config.mjs` `env.schema`, so no application code can observe them.
- **The endpoint's error branch cannot fire for this case.** `src/pages/api/auth/oauth/google.ts:35` calls `signInWithOAuth`, which only *builds* an authorize URL — no network round-trip, no provider validation. `data.url` is always populated, so the `if (error || !data.url)` guard at :40 never catches an unconfigured provider. The user leaves the app before anything can be reported.
- **The best-case landing is misleading.** If the provider error does bounce back through `/auth/callback` (`src/pages/auth/callback.ts:23-25`), the user gets `oauth_failed`: *"We couldn't complete Google sign-in. Please try again or use your email and password."* The retry advice can never succeed.
- **The precedent is already in the tree.** `src/lib/supabase-admin.ts:31` exports `isAdminConfigured()` — a pure, synchronous, trim-and-non-empty check over an env var. `src/pages/account.astro:28` consults it in frontmatter and passes `configured` down; `src/components/account/DeleteAccountPanel.tsx:95-101` returns a localized `role="note"` instead of the control. The rationale is written at `account.astro:15-18`: *"a button that is guaranteed to fail is worse than an honest 'temporarily unavailable'."*
- **The divider is page-level, not island-level.** `signin.astro:51-55` and `signup.astro:33-38` each render the `or` separator immediately above `<GoogleSignInButton />`. Both must disappear together or the page shows a dangling rule.

## Desired End State

A deployment without a Google client id serves `/auth/signin` and `/auth/signup` exactly as they looked before Google shipped — email/password form, no divider, no Google button, no explanatory copy. `POST /api/auth/oauth/google` reached directly on such a deployment redirects to `/auth/signin?error=google_unavailable`, whose localized banner points the user at email and password rather than at a retry. A deployment *with* the client id set behaves exactly as it does today, with no new network calls and no added latency on either auth page.

Verify by unsetting `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, restarting the dev server, and loading both auth pages: no Google affordance, and a hand-rolled `curl -X POST` to the start endpoint lands on the sign-in page with the new banner.

### Key Discoveries:

- `signInWithOAuth` does not validate the provider (`src/pages/api/auth/oauth/google.ts:35`) — the existing error branch is structurally unable to catch this failure. The gate must be a pre-check, not error handling.
- `isAdminConfigured()` at `src/lib/supabase-admin.ts:31` is the exact shape to copy: `Boolean(VAR?.trim())`, no I/O, trivially unit-testable.
- `playwright.quota.config.ts:50` proves `webServer.env` injects an `astro:env/server` var into the E2E dev server (`GENERATION_DAILY_LIMIT: "0"`). `.dev.vars` is gitignored and cannot carry an in-repo test value; `webServer.env` can.
- `.env.example:30` currently ships `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=###`. A plain non-empty check would read that placeholder as configured, which is the most common local setup path — the example must be blanked rather than the sentinel special-cased in shipping code.
- `e2e/oauth-google.spec.ts:46,67` asserts the button **is visible** on both pages, and already stubs the provider hop at `**/auth/v1/authorize**` (:34) — so it never needed real credentials and still won't, given a non-empty dummy.
- `src/components/account/DeleteAccountPanel.test.ts:63-90` establishes the render-assertion technique for a degraded state: `renderToStaticMarkup` + `createElement`, asserting on `getMessages(locale)` strings, with a third case for locale parity.
- `authErrorCodes` is a `const` tuple at `src/lib/i18n/auth-errors.ts:4-12` and `AuthErrorCode` is derived from it, so adding a member makes all three catalogs fail type-check until filled — the drift guard is structural. `src/lib/i18n/messages.test.ts` (R-08) covers key-path parity on top.

## What We're NOT Doing

- **No runtime probe of Supabase's `/auth/v1/settings`.** Rejected in planning: it adds a network call and a fail-open/fail-closed decision to two pages that currently have neither, and its cache makes the result non-deterministic to test.
- **No dedicated `GOOGLE_AUTH_ENABLED` feature flag.** One variable, one truth — a dev who follows the README gets a working button with no second step.
- **No callback hardening.** `/auth/callback` already funnels every provider error to `oauth_failed`; re-classifying provider-disabled there is redundant once the start endpoint refuses.
- **No disabled-button or explanatory-note variant.** The surface disappears; an anonymous visitor is not told about a deployment problem they cannot act on.
- **No config banner integration.** The existing banner is for `SUPABASE_URL` / `POSTHOG_API_KEY`-class misconfiguration; Google is an optional convenience, not a broken app.
- **No E2E coverage of the hidden state.** Playwright cannot change server env per test; proving it would need a second dev-server project for one assertion. Covered by unit + component tests instead.
- **No changes to consent, linking, or the funnel event.** The configured path is untouched.

## Implementation Approach

Mirror the account-deletion pattern end to end: one pure predicate module, consulted server-side at each surface that could otherwise offer a dead end. The predicate is derived from the presence of `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` — the same variable `config.toml` already substitutes locally, so local setup stays a single step. The app never reads the value, only whether it is set.

Two call sites consult it. The pages omit the affordance (cheap, cosmetic, the common path). The start endpoint refuses independently, because it is reachable by direct POST, stale HTML, or a cached page regardless of what rendered — that is the call site that actually closes the dead end.

## Critical Implementation Details

**Ordering inside the start endpoint.** The availability check must run *before* `setConsentCookie` (`src/pages/api/auth/oauth/google.ts:31`), or a refused signup attempt leaves a stray signed consent cookie in the browser with no OAuth round-trip to consume or clear it. Placing it after the existing consent gate but before the Supabase client construction keeps both properties: an unconsented signup still gets `consent_required` (the more specific message), and no cookie is ever set on a refusal.

## Phase 1: Availability predicate

### Overview

Introduce the env var and the pure predicate every later phase consults. Nothing observable changes yet.

### Changes Required:

#### 1. Env schema

**File**: `astro.config.mjs`

**Intent**: Declare the Google client id so `astro:env/server` can expose it, making the provider's configured-ness observable to application code for the first time.

**Contract**: New `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` entry in `env.schema` as `envField.string({ context: "server", access: "secret", optional: true })` — matching every other entry in that block. `optional` keeps the "a missing value degrades a feature rather than crashing the app" invariant stated at README:124-125. Add a comment noting the app reads presence only, never the value, and that production must set it as a Worker var in addition to the hosted Supabase dashboard.

#### 2. The predicate

**File**: `src/lib/auth/google-provider.ts` (new)

**Intent**: Export a single pure function that answers whether the Google sign-in surface can succeed, so both call sites share one definition rather than agreeing by coincidence. Sits alongside the other OAuth helpers (`consent-cookie.ts`, `email-redirect.ts`).

**Contract**: `export function isGoogleAuthConfigured(): boolean` — `Boolean(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID?.trim())`, structurally identical to `isAdminConfigured()` at `src/lib/supabase-admin.ts:31`. No I/O, no async, no ESLint fence (unlike the service-role key, a client id carries no privilege — it is declared `secret` only to keep it out of the client bundle). Document why presence rather than validity is the signal: the app cannot verify the credential without a provider round-trip, and presence is what distinguishes "someone configured this" from "nobody did."

#### 3. Example env file

**File**: `.env.example`

**Intent**: Stop the copied example from reading as configured. A developer who copies `.env.example` and changes nothing must see the unavailable state, not a button that dead-ends.

**Contract**: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` change from `###` to empty values. Extend the existing comment block above them (`.env.example:26-29`) to note that an empty client id hides the Google button rather than breaking anything.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- `.env.example` no longer contains a `###` placeholder for either Google variable

---

## Phase 2: Auth pages omit the Google surface

### Overview

Both auth pages consult the predicate in frontmatter and drop the divider together with the button. The React island is untouched — it never learns about availability, because a component that is not rendered needs no prop.

### Changes Required:

#### 1. Sign-in page

**File**: `src/pages/auth/signin.astro`

**Intent**: Render the Google divider and button only when the provider is configured, so an unconfigured deployment serves the page exactly as it looked before Google shipped.

**Contract**: Import `isGoogleAuthConfigured` from `@/lib/auth/google-provider`, call it in frontmatter, and wrap the divider block (`:51-54`) together with `<GoogleSignInButton …/>` (`:55`) in a single conditional. Both disappear as a unit — a divider with nothing under it reads as a rendering bug. Carry a short comment pointing at the `account.astro:15-18` rationale so the next reader sees this is a house pattern, not a one-off.

#### 2. Sign-up page

**File**: `src/pages/auth/signup.astro`

**Intent**: Same treatment as sign-in.

**Contract**: Identical conditional around `:33-36` (divider) and `:38` (button). Note that the page keeps `SignUpForm`'s own consent checkbox — only the Google button's duplicate consent affordance goes away with it.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- With the client id unset and the dev server restarted, `/auth/signin` and `/auth/signup` show no Google button and no `or` divider — and no leftover vertical gap
- With the client id set, both pages render exactly as before
- Both checks repeated with the UI in Polish (`?lang=pl`) to confirm nothing locale-specific was stranded

---

## Phase 3: Server gate and the `google_unavailable` error code

### Overview

The start endpoint refuses before it can hand the browser to a provider that will reject it, and the refusal carries copy that tells the truth. This is the call site that actually closes the dead end — the endpoint stays reachable by direct POST or stale HTML no matter what the pages rendered.

### Changes Required:

#### 1. Error code

**File**: `src/lib/i18n/auth-errors.ts`

**Intent**: Give the permanent "Google isn't available here" condition its own code, so it stops borrowing `oauth_failed`'s retry advice — which, for this failure, can never succeed.

**Contract**: Add `"google_unavailable"` to the `authErrorCodes` tuple (`:4-12`). `AuthErrorCode` derives from the tuple and `messages.ts` types `errors` as `Record<AuthErrorCode, string>`, so all three catalogs fail type-check until filled — no separate drift guard needed. `classifyAuthError` is not involved: this is a pre-check, not a classified provider error.

#### 2. Message catalogs

**File**: `src/lib/i18n/messages.ts`

**Intent**: Supply en/pl/ru copy that names the working alternative instead of advising a retry.

**Contract**: New `google_unavailable` entry in each of the three `auth.errors` blocks (`:418`, `:755`, `:1092`). English along the lines of *"Google sign-in isn't available right now. Please sign in with your email and password."* Keep it distinct from `oauth_failed` and from `auth_unavailable` in every locale — conflating them is the misleading-copy failure that `src/lib/cv-draft-messages.test.ts:21-24` exists to catch for the generation surface.

#### 3. Start endpoint gate

**File**: `src/pages/api/auth/oauth/google.ts`

**Intent**: Refuse the OAuth start when the provider is unconfigured, rather than redirecting the user out of the app to a Supabase error page.

**Contract**: Insert an `isGoogleAuthConfigured()` check that redirects to `/auth/signin?error=google_unavailable`. Placement is load-bearing — see "Critical Implementation Details": after the existing `consent_required` gate (`:21-23`), before `setConsentCookie` (`:31`), so a refused signup never leaves an orphaned consent cookie. Extend the module doc comment to state that the existing `if (error || !data.url)` branch cannot catch an unconfigured provider, so the pre-check is not redundant with it.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Locale parity test passes: `npm run test -- src/lib/i18n/messages.test.ts`
- Full unit suite passes: `npm run test`

#### Manual Verification:

- With the client id unset, `curl -i -X POST -d 'intent=signin' http://localhost:4321/api/auth/oauth/google` returns a redirect to `/auth/signin?error=google_unavailable`
- Loading that URL shows the new banner in all three locales, and the wording does not advise retrying Google
- The same POST with `intent=signup` and no consent field still yields `consent_required`, and sets no consent cookie in either refusal

---

## Phase 4: Coverage, risk register, and documentation

### Overview

Pin the three properties that would otherwise regress silently, keep the existing E2E suite green, and update the two documents that describe env-var behavior as a contract.

### Changes Required:

#### 1. Predicate unit test

**File**: `src/lib/auth/google-provider.test.ts` (new)

**Intent**: Prove the predicate's exact boundary — in particular that whitespace and empty string read as unconfigured, which is what makes blanking `.env.example` sufficient.

**Contract**: Colocated per the repo's helper-test convention. Mock `astro:env/server` (the alias stub is wired in `vitest.config.ts`) across the cases: unset, empty, whitespace-only, and a real value. Assert `false` for the first three and `true` for the last.

#### 2. Page render tests

**File**: `src/tests/auth-google-availability.test.ts` (new)

**Intent**: Assert the user-visible deliverable — that the button and divider are both absent when unconfigured and both present when configured. Without this, a refactor can quietly restore the dead end.

**Contract**: Lives under `src/tests/` because it exercises route modules — never under `src/pages/` (R-09, `src/tests/no-tests-under-pages.test.ts`). Follow the `DeleteAccountPanel.test.ts:63-90` shape: assert on `getMessages(locale)` strings rather than markup, and include a non-English case so a locale-specific regression is caught. Cover both pages, both states, and specifically that `auth.google.divider` disappears with the button.

#### 3. Route refusal test

**File**: `src/tests/api/auth-oauth-google.test.ts`

**Intent**: Pin the refusal and its ordering — that an unconfigured deployment redirects to `google_unavailable` and sets no consent cookie.

**Contract**: Extend the existing suite. New cases: unconfigured + `intent=signin` → `/auth/signin?error=google_unavailable`; unconfigured + consented `intent=signup` → same redirect **and** `setConsentCookie` not called (the ordering guarantee); unconfigured + unconsented signup → still `consent_required`, since the more specific gate runs first. Existing configured-path cases must keep passing untouched.

#### 4. E2E environment

**File**: `playwright.config.ts`

**Intent**: Keep the two existing Google specs meaningful without requiring any developer to hold real Google credentials.

**Contract**: Add `env: { SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: "e2e-google-client-id" }` to the `webServer` block, mirroring `playwright.quota.config.ts:50`. The value is never used — only its presence — and the specs already stub the provider hop at `**/auth/v1/authorize**` (`e2e/oauth-google.spec.ts:34`), so nothing reaches real Google. Comment it so the next reader understands the dummy is a *signal*, not a credential.

#### 5. Risk register

**File**: `context/foundation/test-plan.md`

**Intent**: Name the risk this change closes, so the coverage has something to cite.

**Contract**: New `R-17` row: an auth page offers a sign-in method the deployment cannot complete — a dead-end affordance that sends the user out of the app to a provider error page they cannot act on. Coverage column points at the three test files from this phase. Follow the existing table's column shape and prose register.

#### 6. Documentation

**File**: `README.md`

**Intent**: Extend the env-var contract table and the Google setup section, both of which currently describe behavior this change alters.

**Contract**: New row in the table at `:127-141` — `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, "Required for: Google sign-in", "Missing-value behavior: the Google button is hidden on both auth pages; the start endpoint refuses". In the "Google sign-in (OAuth)" section (`:202-217`), add the production step that the client id must **also** be set as a Cloudflare Worker var (`npx wrangler secret put`), and explain why: the hosted dashboard is where Supabase reads it, but the Worker needs it to know the provider exists. Call out the failure mode explicitly — set in the dashboard but not on the Worker means Google works yet the button never appears.

### Success Criteria:

#### Automated Verification:

- Full unit suite passes: `npm run test`
- Type checking passes: `npx astro sync && npx astro check`
- Linting and formatting pass: `npm run lint` and `npm run format`
- Test-placement guard passes: `npm run test -- src/tests/no-tests-under-pages.test.ts`
- Existing Google E2E specs pass with local Supabase up: `npm run db:start` then `npm run test:e2e -- oauth-google`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Deliberate-break check: remove the conditional in `signin.astro`, confirm the page render test goes red, then revert
- `README.md` env table renders correctly and the new row matches the observed behavior from Phase 2/3 manual checks
- `R-17`'s coverage column points at files that exist

---

## Testing Strategy

Cites **R-17** (new, added in Phase 4): an auth page offers a sign-in method the deployment cannot complete.

### Unit Tests:

- `src/lib/auth/google-provider.test.ts` — the predicate boundary: unset, empty, whitespace-only, real value. The whitespace case is what licenses the blanked `.env.example`.
- `src/lib/i18n/messages.test.ts` (existing, R-08) — picks up the new `google_unavailable` key automatically and fails if any locale lacks it.

### Integration Tests:

- `src/tests/auth-google-availability.test.ts` — both auth pages, both states, asserting divider and button vanish together, with a non-English case.
- `src/tests/api/auth-oauth-google.test.ts` — the refusal redirect, the no-consent-cookie ordering guarantee, and the precedence of `consent_required` over `google_unavailable`.

### E2E:

No new spec. The hidden state cannot be driven from Playwright without a second dev-server project, and the assertion is fully covered by the render tests. The existing `e2e/oauth-google.spec.ts` stays green via the `webServer.env` dummy — it continues to test the configured path, which is the one with a browser-only boundary (client-side consent gating → real POST → 303 → authorize).

### Manual Testing Steps:

1. Unset `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, restart the dev server, load `/auth/signin` and `/auth/signup` — no button, no divider, no stray gap.
2. `curl -i -X POST -d 'intent=signin' http://localhost:4321/api/auth/oauth/google` — expect a redirect to `/auth/signin?error=google_unavailable`; load that URL and read the banner in en, pl, and ru.
3. Repeat step 2 with `intent=signup&consent=on` and confirm no consent cookie appears in the response headers.
4. Set the client id back, restart, and confirm both pages and the full Google round-trip behave exactly as before.

## Performance Considerations

The predicate is a synchronous string check on a value `astro:env` has already resolved — no I/O, no measurable cost on either auth page. This was the decisive argument against the `/auth/v1/settings` probe, which would have added a network round-trip to every anonymous auth-page render.

## Migration Notes

There is a **deployment step**, and skipping it is the one way this change can regress production: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` must be set as a Cloudflare Worker var *before or with* the deploy, or Google sign-in — which works today — will silently lose its button. The value is the same client id already in the hosted Supabase dashboard (**Authentication → Providers → Google**).

```bash
npx wrangler secret put SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
```

No data migration, no schema change. Rollback is a plain revert; nothing persists state.

## References

- Prior change (built the surface this one degrades): `context/changes/google-signin-linking/plan.md`
- The pattern being mirrored: `src/lib/supabase-admin.ts:31`, `src/pages/account.astro:15-28`, `src/components/account/DeleteAccountPanel.tsx:95-101`
- Degraded-state test technique: `src/components/account/DeleteAccountPanel.test.ts:63-90`
- E2E env injection precedent: `playwright.quota.config.ts:50`
- Risk register: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Availability predicate

#### Automated

- [x] 1.1 Type checking passes: `npx astro sync && npx astro check`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm run test`
- [x] 1.4 Production build succeeds: `npm run build`

#### Manual

- [x] 1.5 `.env.example` no longer contains a `###` placeholder for either Google variable

### Phase 2: Auth pages omit the Google surface

#### Automated

- [ ] 2.1 Type checking passes: `npx astro sync && npx astro check`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Production build succeeds: `npm run build`

#### Manual

- [ ] 2.4 Unconfigured: no Google button, no divider, no leftover gap on either auth page
- [ ] 2.5 Configured: both pages render exactly as before
- [ ] 2.6 Both checks repeated in Polish

### Phase 3: Server gate and the `google_unavailable` error code

#### Automated

- [ ] 3.1 Type checking passes: `npx astro sync && npx astro check`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Locale parity test passes: `npm run test -- src/lib/i18n/messages.test.ts`
- [ ] 3.4 Full unit suite passes: `npm run test`

#### Manual

- [ ] 3.5 Direct POST to the start endpoint redirects to `/auth/signin?error=google_unavailable`
- [ ] 3.6 The banner reads correctly in all three locales and does not advise retrying Google
- [ ] 3.7 Unconsented signup still yields `consent_required`; neither refusal sets a consent cookie

### Phase 4: Coverage, risk register, and documentation

#### Automated

- [ ] 4.1 Full unit suite passes: `npm run test`
- [ ] 4.2 Type checking passes: `npx astro sync && npx astro check`
- [ ] 4.3 Linting and formatting pass: `npm run lint` and `npm run format`
- [ ] 4.4 Test-placement guard passes: `npm run test -- src/tests/no-tests-under-pages.test.ts`
- [ ] 4.5 Existing Google E2E specs pass: `npm run test:e2e -- oauth-google`
- [ ] 4.6 Production build succeeds: `npm run build`

#### Manual

- [ ] 4.7 Deliberate-break check on the page render test goes red, then reverted
- [ ] 4.8 README env table row matches observed behavior
- [ ] 4.9 R-17's coverage column points at files that exist
