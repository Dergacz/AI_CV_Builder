# Google Consent Notice Implementation Plan

## Overview

Replace the consent checkbox attached to the "Continue with Google" button with an inline consent
notice: clicking the button _is_ the act of acceptance. The consent cookie is then set
unconditionally for every Google start, and `/auth/callback` keeps stamping `consent_version` onto
brand-new accounts exactly as it does today.

The change is motivated by a concrete dead-end in production: a first-time visitor who clicks
"Continue with Google" on `/auth/signin` completes the whole OAuth round-trip and is then signed
out and bounced to `/auth/signup?error=consent_required`, because the signin-intent path never set
the consent cookie. Closing that dead-end falls out of the same edit rather than needing its own fix.

## Current State Analysis

The Google surface is one React island, `GoogleSignInButton.tsx`, rendered by both auth pages and
parameterised by an `intent` prop. Consent is enforced at three independent points:

1. **Client** — `GoogleSignInButton.tsx:47-52`: `handleSubmit` calls `preventDefault()` and sets a
   local error when `intent === "signup"` and the checkbox is unticked.
2. **Server (start)** — `src/pages/api/auth/oauth/google.ts:29-31`: rejects a signup-intent POST
   with no `consent` field, redirecting to `/auth/signup?error=consent_required`. Line 45-47 then
   sets the signed consent cookie, again only for `intent === "signup"`.
3. **Server (callback)** — `src/pages/auth/callback.ts:40-48`: for a resolved account that carries
   no `consent_version` in its metadata, requires the consent cookie; absent it, signs the session
   out and redirects to `/auth/signup?error=consent_required`.

Point 3 is what produces the dead-end. It is written as a fail-closed safety net, but because point
2 only ever sets the cookie on the signup path, it is currently the _normal_ outcome for anyone
whose first-ever contact with the app is the Google button on the sign-in page.

Consent copy lives in `auth.form.signup.consent` as five fragments (`prefix`, `termsLabel`,
`conjunction`, `privacyLabel`, `suffix`) so `ConsentCheckbox` can embed `/terms` and `/privacy`
links inside the sentence. The `auth.google` block currently holds only `button` and `divider`.

Two constraints discovered while surveying the test surface:

- `src/lib/i18n/messages.test.ts` enforces key-path parity across en/pl/ru (risk R-08), so any new
  copy key must land in all three catalogs or the suite goes red.
- **There is no React rendering test infrastructure in this repo.** No `@testing-library/react`, no
  jsdom or happy-dom, no `environment` field in `vitest.config.ts`, and no `.test.tsx` file exists
  anywhere — the discovery glob is `src/**/*.test.ts`, which would not even pick one up. The
  established substitute is a static source assertion; `src/tests/auth-google-availability.test.ts`
  is the precedent, and its file header documents why.

## Desired End State

Both auth pages render a bare "Continue with Google" button with a short notice beneath it reading,
in the active locale, "By continuing, you agree to the **Terms of Service** and **Privacy
Policy**", where both names are links to `/terms` and `/privacy`. No checkbox appears anywhere in
the Google form on either page. The email signup form keeps its own checkbox, untouched.

Clicking the button on either page starts OAuth immediately and sets the signed consent cookie. A
brand-new account arriving at `/auth/callback` finds that cookie, gets `consent_version` and
`consent_accepted_at` stamped onto its metadata, emits `funnel_signup_completed` with
`method=google`, and lands on `/dashboard`. No user-visible path exists that creates a Google
account without a consent record.

Verify by signing in with a Google account that has never used the app, starting from
`/auth/signin`: the flow must end at `/dashboard`, and the account's `user_metadata` must carry
`consent_version`.

### Key Discoveries:

- `src/pages/auth/callback.ts:40-48` is the fail-closed branch that produces the reported symptom;
  it is correct as written and stays untouched. What changes is that it stops being reachable by an
  ordinary user, because the cookie will now always have been set.
- `src/lib/auth/consent-cookie.ts:40-46` signs with `OBSERVABILITY_ID_SALT` and **fails closed** —
  no salt means `setConsentCookie` writes nothing and `readConsentCookie` returns null. Verified
  present in the production Worker via `npx wrangler secret list`. If it were ever removed, every
  Google _signup_ would break; this is called out in Migration Notes.
- `src/tests/auth-google-availability.test.ts:48,57,68` matches on the bare string
  `<GoogleSignInButton` with no attributes, so dropping the `intent` prop does not disturb it.
- `e2e/oauth-google.spec.ts:60-83` is built entirely around the checkbox gate — click, assert the
  error text, `getByRole("checkbox").check()`, click again. It needs rewriting, not patching. Its
  header comment at lines 18-20 explains a locator workaround for "TWO consent checkboxes with
  identical name/label" on the signup page; after this change there is only one, so the workaround
  loses its reason to exist.
- `src/pages/api/auth/oauth/google.ts:33-38` carries the `isGoogleAuthConfigured` gate added by the
  `google-unavailable-state` change, whose comment documents an ordering constraint relative to the
  consent gate. Removing the consent gate makes that comment stale.

## What We're NOT Doing

- **Not converting `GoogleSignInButton` to an Astro component.** After this change it holds no
  state and no handlers, which by the `CLAUDE.md` rule ("React components only when interactivity
  is needed") argues for `.astro`. Deliberately deferred: it would touch both pages, the R-17
  availability test's static-assertion rationale, and the E2E locators, all for no user-visible
  gain. Worth a follow-up change.
- **Not touching the email signup form.** `SignUpForm.tsx` keeps its `ConsentCheckbox`, and
  `signup-validation.ts` / `/api/auth/signup` are untouched. The signup page will show a checkbox
  (email) and a notice (Google) side by side; that asymmetry is accepted.
- **Not removing the `consent_required` error code.** It is still produced by `/api/auth/signup`
  for the email path and by the callback's fail-closed branch.
- **Not adding React rendering tests.** See Current State Analysis; the substitute is a static
  source assertion following the existing precedent.
- **Not re-prompting existing accounts.** `POLICY_VERSION` is a record, not a gate — nothing
  compares it against stored `consent_version`, and this change does not alter that.

## Implementation Approach

Four phases, ordered so the working tree is never in a broken intermediate state. Copy lands first
(purely additive, consumed by nobody). The **server relaxes before the client stops sending** —
phase 2 makes the route ignore `consent` and `intent` while the old form still submits them, which
is a no-op for the user; phase 3 then strips the fields from the form. The reverse order would
leave a window where the form sends no `intent`, the route defaults it to `"signin"`, the cookie
never gets set, and every new Google signup hits the fail-closed branch.

Phase 4 collects the coverage that spans phases: the rewritten E2E spec and the risk register row.

## Critical Implementation Details

**Ordering (phase 2 vs 3).** Stated above and load-bearing: relax the server first. A reviewer
looking at phase 2 in isolation will see a route that accepts fields it no longer reads — that is
intentional and temporary, resolved by phase 3.

**Stale comment in the availability gate.** `src/pages/api/auth/oauth/google.ts:33-35` explains its
own position relative to the consent gate ("after the consent gate … before setConsentCookie, so a
refused signup never leaves a signed consent cookie behind"). Once the consent gate is gone that
reasoning no longer describes the code. The gate's _position_ still matters — it must stay before
`setConsentCookie`, so an unconfigured-provider refusal does not leave an orphaned cookie — so
rewrite the comment to state that surviving reason rather than deleting it.

---

## Phase 1: Consent-notice copy

### Overview

Add the notice copy to the i18n catalogs. Additive only — no component consumes it yet, so this
phase cannot change behavior.

### Changes Required:

#### 1. Locale catalogs

**File**: `src/lib/i18n/messages.ts`

**Intent**: Give the Google button its own consent sentence, structured as fragments so the
component can embed `/terms` and `/privacy` links inside the text. A separate block rather than
reuse of `auth.form.signup.consent` keeps the sign-in page's copy independent of the signup form's.

**Contract**: Extend the `google` member of the `AuthCopy` interface (currently `button` +
`divider`, around line 241) with a `consent` object carrying the same five fragment keys already
used by `SignUpFormCopy["consent"]`: `prefix`, `termsLabel`, `conjunction`, `privacyLabel`,
`suffix`. Add the corresponding literal to all three catalogs (en ~414, pl ~752, ru ~1090). The
`prefix` differs from the checkbox's — it reads as a statement about the click ("By continuing, you
agree to ") rather than a first-person promise ("I agree to "). `termsLabel`, `conjunction`,
`privacyLabel` and `suffix` mirror the existing per-locale values so the two sentences name the
same documents identically.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Locale parity holds (R-08): `npm run test`
- Linting passes: `npm run lint`

---

## Phase 2: Start endpoint — drop the consent gate, always set the cookie

### Overview

Make the OAuth start endpoint treat every request as consented, and record that consent in the
signed cookie regardless of which page the click came from. This alone closes the reported dead-end.

### Changes Required:

#### 1. OAuth start endpoint

**File**: `src/pages/api/auth/oauth/google.ts`

**Intent**: Stop reading `intent` and `consent` from the form; call `setConsentCookie`
unconditionally before handing off to the provider. Rewrite the module doc and the availability-gate
comment, both of which currently describe a consent gate that no longer exists.

**Contract**: The route's external contract narrows to: POST with no meaningful body → either a 303
to the provider authorize URL, or a redirect to `/auth/signin` with `error=google_unavailable` /
`error=auth_unavailable`. The `consent_required` outcome disappears from this route entirely. The
`isGoogleAuthConfigured()` check must remain positioned before `setConsentCookie` so a refusal never
leaves an orphaned signed cookie.

#### 2. Route tests

**File**: `src/tests/api/auth-oauth-google.test.ts`

**Intent**: Re-point the suite at the new contract. Three existing cases encode the removed gate and
must change: the signup-without-consent rejection (line 56) no longer applies and is replaced by a
case asserting that a start with no `consent` field still proceeds and sets the cookie; the
signin-intent case (line 75) inverts — it must now assert the cookie _is_ set; and the
"reports missing consent first" precedence case (line 116) loses its subject, replaced by a case
asserting the unconfigured-provider refusal still leaves no cookie behind.

### Success Criteria:

#### Automated Verification:

- Unit and route tests pass: `npm run test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- With local Supabase up and a Google account that has never used the app, click "Continue with
  Google" on `/auth/signin` — the flow ends on `/dashboard`, not on
  `/auth/signup?error=consent_required`
- The resulting account carries `consent_version` in its `user_metadata`

---

## Phase 3: Google button — checkbox to notice

### Overview

Strip all consent state and the `intent` plumbing from the island, and render the notice beneath the
button on both pages.

### Changes Required:

#### 1. Google sign-in island

**File**: `src/components/auth/GoogleSignInButton.tsx`

**Intent**: Remove the `ConsentCheckbox`, both `useState` calls, `handleSubmit`, the `noValidate` /
`onSubmit` wiring, the hidden `intent` input and the `intent` prop. Render the consent notice under
the button using the Phase 1 copy, with `termsLabel` and `privacyLabel` as anchors to `/terms` and
`/privacy`. Associate the notice with the button via `aria-describedby` so screen-reader users hear
what the click commits them to before activating it.

**Contract**: `Props` narrows to `{ locale: UiLocale }`. The form keeps
`method="POST" action="/api/auth/oauth/google"` — `e2e/oauth-google.spec.ts` locates it by that
action, and the availability test matches the bare `<GoogleSignInButton` tag, so neither breaks. The
component becomes stateless; keep the default export and the file path unchanged.

#### 2. Auth pages

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`

**Intent**: Drop the `intent` attribute from both `<GoogleSignInButton />` usages. Nothing else on
these pages changes — the `googleAvailable` guard, the divider and `client:only="react"` all stay.

**Contract**: Both call sites become `<GoogleSignInButton locale={locale} client:only="react" />`.

#### 3. Component structure test

**File**: `src/tests/google-consent-notice.test.ts` (new)

**Intent**: Pin the structural invariants that no other layer can see, using a static source
assertion over `GoogleSignInButton.tsx` — the repo has no React rendering stack (see Current State
Analysis), and `src/tests/auth-google-availability.test.ts` is the established precedent for this
shape. Give the file a header explaining that constraint, as that precedent does.

**Contract**: Assert that the source no longer imports `ConsentCheckbox`, contains no `useState`,
references the `auth.google.consent` copy path, and links both `/terms` and `/privacy`. Placed under
`src/tests/` per the placement rule enforced by `src/tests/no-tests-under-pages.test.ts`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- `/auth/signin` and `/auth/signup` both show the button with the notice beneath it and no checkbox
  in the Google form
- The notice's "Terms of Service" and "Privacy Policy" links open `/terms` and `/privacy`
- `/auth/signup` shows exactly one checkbox overall — the email form's
- Switching locale to Polish and Russian renders the notice translated, links intact

---

## Phase 4: E2E, risk register, docs

### Overview

Re-point the end-to-end coverage at the new behavior and record the invariant this change now rests
on.

### Changes Required:

#### 1. End-to-end spec

**File**: `e2e/oauth-google.spec.ts`

**Intent**: Rewrite the second test. Its current subject — "blocked until consent" — no longer
exists; the replacement asserts that the signup page's Google form carries no checkbox, shows the
notice with both policy links, and hands off to the provider on the first click. Update the header
comment: the risk statement, the "TWO consent checkboxes" locator note (now obsolete) and the
deliberate-break recipe all describe the removed gate.

**Contract**: Keep the existing `GOOGLE_FORM` action-based scoping and the
`**/auth/v1/authorize**` stub — the provider hop must still never be reached. The new
deliberate-break recipe should be one that fails the rewritten assertion, e.g. restoring a
`ConsentCheckbox` render inside the Google form.

#### 2. Risk register

**File**: `context/foundation/test-plan.md`

**Intent**: Add row R-18 for the invariant this change makes load-bearing — a Google account must
never be created without a consent record — and note in R-17's coverage cell that the route test
file also now guards the no-orphaned-cookie property under the new contract.

**Contract**: One new `| R-18 | … |` row following the existing four-column shape, citing
`src/tests/api/auth-oauth-google.test.ts`, `src/tests/google-consent-notice.test.ts` and
`e2e/oauth-google.spec.ts`.

#### 3. Consent documentation

**File**: `README.md`

**Intent**: Record how Google consent is captured now, and the operational dependency that follows
from it: `OBSERVABILITY_ID_SALT` doubles as the consent-cookie signing key, so removing it from the
Worker breaks every new Google signup (existing accounts are unaffected — they already carry
`consent_version`).

**Contract**: A short subsection under the existing auth documentation. No new env vars.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- E2E suite passes with local Supabase up: `npm run test:e2e`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Formatting is clean on touched files: `npx prettier --check <touched files>`

#### Manual Verification:

- The rewritten E2E spec's deliberate-break check goes red when the break is applied, then green
  again once reverted

---

## Testing Strategy

### Unit Tests:

- **Route contract** (`src/tests/api/auth-oauth-google.test.ts`): a start with no `consent` field
  proceeds and sets the cookie; a signin-page start sets the cookie; an unconfigured provider still
  refuses and leaves no cookie behind.
- **Locale parity** (`src/lib/i18n/messages.test.ts`, existing): the new `auth.google.consent`
  fragments exist in all three catalogs. This is free coverage — the test already enforces it.
- **Component structure** (`src/tests/google-consent-notice.test.ts`): no `ConsentCheckbox` import,
  no `useState`, notice copy referenced, both policy links present.

### Integration Tests:

- **E2E** (`e2e/oauth-google.spec.ts`): both auth pages render the button with the notice and no
  checkbox, and the first click reaches the provider authorize hop. The UI → start endpoint → 303 →
  provider boundary is real; only the provider hop is stubbed.

### Manual Testing Steps:

1. Start local Supabase (`npm run db:start`) and the dev server (`npm run dev`).
2. Open `/auth/signin` — confirm the notice under the Google button, no checkbox, links working.
3. Repeat on `/auth/signup` — confirm exactly one checkbox on the page (the email form's).
4. Switch the locale to `pl` and `ru` and re-check the notice text and links.
5. With a Google account that has never used the app, click through from `/auth/signin` and confirm
   the flow ends on `/dashboard`.
6. Inspect the new account's `user_metadata` and confirm `consent_version` is stamped.

Risk coverage: this change adds **R-18** to `context/foundation/test-plan.md` and extends the
coverage note on **R-17**.

## Migration Notes

No data migration, no schema change, no new environment variable. Existing accounts are unaffected:
they already carry `consent_version`, so `/auth/callback` takes the `alreadyConsented` path and
never consults the cookie.

One operational dependency becomes more load-bearing than before. `OBSERVABILITY_ID_SALT` signs the
consent cookie (`src/lib/auth/consent-cookie.ts:40-46`) and the helper fails closed when it is
absent. It is currently set in the production Worker (verified via `npx wrangler secret list`). If
it were ever removed, every _new_ Google signup would silently dead-end at
`/auth/signup?error=consent_required` — the same symptom this change fixes, from a different cause.
Phase 4 records this in the README.

## References

- Change identity: `context/changes/google-consent-notice/change.md`
- Prior change that added the availability gate this plan edits around:
  `context/changes/google-unavailable-state/plan.md`
- Static-source-assertion precedent: `src/tests/auth-google-availability.test.ts`
- Fail-closed callback branch: `src/pages/auth/callback.ts:40-48`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Consent-notice copy

#### Automated

- [x] 1.1 Type checking passes: `npx astro check` — 72c423f
- [x] 1.2 Locale parity holds (R-08): `npm run test` — 72c423f
- [x] 1.3 Linting passes: `npm run lint` — 72c423f

### Phase 2: Start endpoint — drop the consent gate, always set the cookie

#### Automated

- [x] 2.1 Unit and route tests pass: `npm run test` — ad95309
- [x] 2.2 Type checking passes: `npx astro check` — ad95309
- [x] 2.3 Linting passes: `npm run lint` — ad95309

#### Manual

- [ ] 2.4 A never-seen Google account clicking from `/auth/signin` ends on `/dashboard`
- [ ] 2.5 The resulting account carries `consent_version` in its `user_metadata`

### Phase 3: Google button — checkbox to notice

#### Automated

- [x] 3.1 Unit tests pass: `npm run test` — 6fd7c01
- [x] 3.2 Type checking passes: `npx astro check` — 6fd7c01
- [x] 3.3 Linting passes: `npm run lint` — 6fd7c01
- [x] 3.4 Production build succeeds: `npm run build` — 6fd7c01

#### Manual

- [ ] 3.5 Both auth pages show the button with the notice and no checkbox in the Google form
- [ ] 3.6 The notice's links open `/terms` and `/privacy`
- [ ] 3.7 `/auth/signup` shows exactly one checkbox overall — the email form's
- [ ] 3.8 Polish and Russian render the notice translated with links intact

### Phase 4: E2E, risk register, docs

#### Automated

- [x] 4.1 Unit tests pass: `npm run test`
- [x] 4.2 E2E suite passes with local Supabase up: `npm run test:e2e`
- [x] 4.3 Type checking passes: `npx astro check`
- [x] 4.4 Linting passes: `npm run lint`
- [x] 4.5 Formatting is clean on touched files: `npx prettier --check <touched files>`

#### Manual

- [x] 4.6 The rewritten deliberate-break check goes red when applied, then green once reverted
