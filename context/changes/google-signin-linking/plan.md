# Google Sign-In with Account Linking Implementation Plan

## Overview

Add **"Continue with Google"** to the existing email/password authentication system. A Google login auto-links to an existing account when the verified email matches (Supabase's default behavior); a brand-new Google account captures Terms/Privacy consent — carried across the OAuth redirect via a short-lived signed cookie — and is stamped into user metadata and counted in the analytics funnel. OAuth failures fall back to the existing sign-in error banner. Scope is **Google only**, auto-link only — no unlink/settings UI.

## Current State Analysis

The app is Astro 6 SSR (Cloudflare Workers) with Supabase cookie-based sessions. Auth today is **email/password only**, redirect-based, with no OAuth code anywhere.

- **Supabase client seam**: `src/lib/supabase.ts:7` `createClient(requestHeaders, cookies)` returns an SSR client (or `null` when env is missing). All auth endpoints use it; the OAuth flow will too.
- **Auth endpoints** (`src/pages/api/auth/{signin,signup,signout,resend}.ts`): all return 302 redirects, classify errors via `classifyAuthError()`, and carry error codes through `?error=` query params.
- **Consent is a hard gate** in `src/pages/api/auth/signup.ts:14-16`: signup is rejected without the consent checkbox, and on success it stamps `consent_version` + `consent_accepted_at` into Supabase user metadata via the `signUp` `options.data`. The OAuth path bypasses this form, so consent must be re-captured.
- **Email confirmation**: `src/middleware.ts:45` blocks any session whose `email_confirmed_at` is null. Google returns pre-verified emails, so OAuth sessions satisfy this for free.
- **Funnel**: `funnel_signup_completed` is emitted inside `signup.ts` with `{ locale }` and the anonymous identity. The OAuth path won't hit that emit point. Event names are a closed union in `src/lib/observability/events.ts`; identity is resolved via `resolveRequestIdentity(user, cookies)` (`src/lib/observability/identity.ts`).
- **i18n**: 3 locales (`en`, `pl`, `ru`) in `src/lib/i18n/messages.ts`; `src/lib/i18n/messages.test.ts` enforces identical key coverage across all three. Auth error codes live in `src/lib/i18n/auth-errors.ts` (`AUTH_ERROR_CODES`, `classifyAuthError`, `resolveAuthErrorCode`, `getAuthErrorMessage`).
- **Auth pages** (`src/pages/auth/{signin,signup}.astro`): host React form islands (`SignInForm`, `SignUpForm`) inside a card; read `?error=` and render it through the `ServerError` banner component.
- **Config**: `supabase/config.toml:305` has a disabled `[auth.external.apple]` stub showing the env-substitution pattern (`secret = "env(...)"`). `site_url = http://127.0.0.1:3000`, `additional_redirect_urls` allow-lists redirect targets. No Google provider configured.
- **E2E**: real Supabase, password storageState (`e2e/auth.setup.ts`); no mechanism to complete a real Google login.

### Key Discoveries:

- `signInWithOAuth` must run **server-side** here (PKCE + SSR cookies). It returns `data.url`; the endpoint redirects the browser to it. The exchange happens in a **new callback route** via `exchangeCodeForSession(code)` — neither exists today.
- Supabase **auto-links** an OAuth identity to an existing user when the provider returns a verified email that matches — this is the default and requires no code. The "linking" requirement is satisfied by configuration + relying on this default.
- Local Google sign-in requires `skip_nonce_check = true` under `[auth.external.google]` (see the Apple stub comment at `supabase/config.toml:315`).
- Consent metadata is written via `auth.updateUser({ data: {...} })` post-exchange (the `signUp` `options.data` seam isn't available on the OAuth path).

## Desired End State

- `/auth/signin` and `/auth/signup` each show a "Continue with Google" button. On signup the button has its own Terms/Privacy consent checkbox; on signin it does not.
- Clicking the button (signup: only when consent is checked) redirects to Google, then back through `/auth/callback`, ending on `/dashboard` with an authenticated session.
- A returning Google user (or a Google email matching an existing password account) lands on the same account — no duplicate.
- A new Google account has `consent_version` + `consent_accepted_at` in its metadata and produced exactly one `funnel_signup_completed` event tagged `method: "google"`.
- A new account that somehow reaches the callback with no valid consent cookie is signed out and redirected to `/auth/signup?error=consent_required`.
- Any OAuth failure lands on `/auth/signin?error=<code>` with a localized banner.
- Verify: unit tests green for the start endpoint, callback, and i18n parity; E2E confirms both buttons render and clicking initiates the Google redirect; manual run completes a real Google login locally.

## What We're NOT Doing

- **No other providers** — Google only; Apple/GitHub/etc. stubs stay disabled.
- **No unlink/disconnect UI** and **no account-settings / identity-management page** — linking is automatic by email.
- **No reconciliation of mismatched emails** — if the Google email differs from an existing account's email, Supabase creates a separate account; we do not merge them.
- **No `returnTo`/deep-link restoration** — success always lands on `/dashboard`, matching password sign-in.
- **No manual `linkIdentity()` flow** and **no `enable_manual_linking`** — out of scope.

## Implementation Approach

Two new server routes plus a shared button component:

1. **Start endpoint** (`/api/auth/oauth/google`, POST): validates consent for the signup intent, sets a short-lived signed httpOnly consent cookie when consent was given, calls `signInWithOAuth({ provider: "google", options: { redirectTo: <callback> } })`, and redirects to `data.url`.
2. **Callback route** (`/auth/callback`): exchanges the code for a session, decides new-vs-returning, enforces/stamps consent for new accounts, emits the funnel event for new accounts, clears the consent cookie, and redirects to `/dashboard` (success) or an `?error=` page (failure).
3. **UI**: a `GoogleSignInButton` island used by both auth pages — bare on signin, wrapped with a consent checkbox + client validation on signup.

The signed consent cookie is the consent transport: it is server-set (tamper-evident), httpOnly, scoped to the callback, short TTL, and cleared after read.

## Critical Implementation Details

- **New-vs-returning detection (callback).** After `exchangeCodeForSession`, distinguish a freshly created account from a returning/linked one. Prefer comparing `user.created_at` to `user.last_sign_in_at` (equal/near-equal ⇒ new) and/or treating "no `consent_version` in metadata" as the new-account signal, since every consented account (password or prior Google) already carries it. Do not rely on `identities.length` alone — an auto-linked account can have multiple identities on first Google login. This detection drives both consent enforcement and the funnel emit, so get it right and unit-test the boundary.
- **Consent cookie lifecycle.** The cookie is set only on the signup-intent start request (after consent validation), read once in the callback, and cleared there unconditionally (success or bounce). It must be httpOnly, `secure` outside dev, `sameSite: "lax"` (must survive the top-level redirect back from Google), short TTL (a few minutes), and signed/HMAC'd so the callback can trust it. The OAuth `redirectTo` callback URL must be present in `additional_redirect_urls`.
- **Funnel emit ordering.** Emit `funnel_signup_completed` only after the session exists and the account is confirmed new — mirror the anonymous-identity emit pattern in `signup.ts`, adding a `method: "google"` property. Returning logins emit nothing.

## Phase 1: Supabase Config & Secrets

### Overview

Enable the Google provider in local Supabase config via env substitution, allow-list the callback URL, and document the required environment variables. Foundation for everything downstream.

### Changes Required:

#### 1. Enable Google provider

**File**: `supabase/config.toml`

**Intent**: Turn on `[auth.external.google]` so local Supabase accepts Google logins, following the existing Apple stub's env-substitution pattern; enable local nonce skipping.

**Contract**: New `[auth.external.google]` block with `enabled = true`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`, `skip_nonce_check = true`. Add the OAuth callback URL (e.g. `http://127.0.0.1:3000/auth/callback`) to `additional_redirect_urls`.

#### 2. Document required env vars

**File**: `.env.example`, `.dev.vars` (document, gitignored), `README.md` (or the auth/setup section)

**Intent**: Record the two new env vars and a one-line pointer to obtaining Google OAuth credentials, so contributors can run the flow locally and CI/prod can be configured.

**Contract**: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` entries with placeholder values + a note that prod sets these in the hosted Supabase dashboard.

### Success Criteria:

#### Automated Verification:

- Local Supabase starts with the new config: `npm run db:start`
- Lint passes: `npm run lint`

#### Manual Verification:

- `.env.example` documents both Google env vars
- With real Google credentials set, the local provider is reachable (no config parse errors on `supabase start`)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: OAuth Start Endpoint & Consent Cookie

### Overview

A server endpoint that initiates the Google OAuth redirect, gating on consent for the signup intent and persisting the consent decision in a short-lived signed cookie for the callback to consume.

### Changes Required:

#### 1. Signed consent-cookie helper

**File**: `src/lib/auth/consent-cookie.ts` (new)

**Intent**: Encapsulate setting, reading, and clearing the short-lived signed consent cookie so both the start endpoint and the callback share one tamper-evident contract.

**Contract**: Exports to set the cookie (payload: consent version + accepted-at timestamp), read+verify it (returns the payload or null), and clear it. Cookie is httpOnly, `sameSite: "lax"`, `secure` outside DEV, short TTL, HMAC-signed with a server secret. Signing key sourced from existing server env (declare a new `astro:env/server` var if none fits).

#### 2. OAuth start endpoint

**File**: `src/pages/api/auth/oauth/google.ts` (new)

**Intent**: Validate consent for signup intent, set the consent cookie when given, then start the Google OAuth redirect.

**Contract**: `export const prerender = false`; `POST` handler reading form fields `intent` (`"signin" | "signup"`) and `consent`. Behavior: if `intent === "signup"` and consent is falsy → redirect `/auth/signup?error=consent_required`; if Supabase client is null → redirect `/auth/signin?error=auth_unavailable`; on signup-with-consent → set consent cookie. Call `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <site>/auth/callback } })`; on error redirect `/auth/signin?error=<classified>`; on success redirect 303 to `data.url`.

#### 3. Server env var for cookie signing (if needed)

**File**: `astro.config.mjs` (env schema)

**Intent**: Declare a server-only secret for HMAC signing if no existing secret is suitable.

**Contract**: New `env.schema` entry (server, secret) mirroring the `SUPABASE_KEY` declaration style.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` — cover signup-without-consent → `consent_required`; signin intent → no consent cookie set; success → cookie set (signup) + redirect to `data.url`; Supabase-null → `auth_unavailable`; cookie sign/verify round-trips and a tampered cookie verifies as null
- Type check: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- Posting the signup Google form without consent returns to signup with the consent error
- Posting with consent issues a redirect to a Google URL

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Phase 3: OAuth Callback Route

### Overview

Exchange the OAuth code for a session, branch on new-vs-returning, enforce/stamp consent for new accounts, emit the funnel event for new accounts, and route to the right destination.

### Changes Required:

#### 1. New OAuth error code(s) + localized strings

**File**: `src/lib/i18n/auth-errors.ts`, `src/lib/i18n/messages.ts`

**Intent**: Add an `oauth_failed` auth-error code (and reuse `auth_unavailable` for null-client) so callback failures render through the existing `ServerError` banner.

**Contract**: Extend `AUTH_ERROR_CODES` with `"oauth_failed"`; add its message to `auth.errors` in all three locales (`en`/`pl`/`ru`). `classifyAuthError`/`resolveAuthErrorCode` fall back to `oauth_failed` for callback errors.

#### 2. Callback route

**File**: `src/pages/auth/callback.ts` (new)

**Intent**: Complete the OAuth round-trip: exchange code, decide new-vs-returning, enforce consent and stamp it for new accounts, emit the funnel event, clear the consent cookie, and redirect.

**Contract**: `export const prerender = false`; `GET` handler. Reads `code` (and `error`/`error_description` from provider). Flow:
- Provider returned an error, or no `code`, or Supabase null → redirect `/auth/signin?error=oauth_failed` (or `auth_unavailable`).
- `exchangeCodeForSession(code)`; on error → `/auth/signin?error=oauth_failed`.
- Determine new-vs-returning (see Critical Implementation Details).
- **New account**: read consent cookie. If valid → `auth.updateUser({ data: { consent_version, consent_accepted_at } })` and emit `funnel_signup_completed` with `{ locale, method: "google" }` via the anonymous-identity pattern. If absent/invalid → `auth.signOut()` and redirect `/auth/signup?error=consent_required`.
- **Returning account**: no consent write, no funnel emit.
- Always clear the consent cookie; success → redirect `/dashboard`.

#### 3. Funnel property support

**File**: `src/lib/observability/funnel.ts` (or wherever `funnel_signup_completed` is emitted) / `src/lib/observability/events.ts`

**Intent**: Allow the `method` property on the existing signup event without adding a new event name.

**Contract**: Emit path accepts a `method` property; existing password signup continues to emit without it (or with `method: "password"` — match whatever keeps `events.ts` union and tests consistent). No new event in the closed union.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test` — new account + valid consent → consent stamped + one `funnel_signup_completed{method:"google"}` + redirect `/dashboard`; new account + no consent cookie → `signOut` + redirect `/auth/signup?error=consent_required`; returning account → no stamp, no emit, redirect `/dashboard`; exchange error → `/auth/signin?error=oauth_failed`; consent cookie cleared in all branches
- i18n parity test passes for the new error code across en/pl/ru: `npm test`
- Type check: `npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- Real Google login as a new user lands on `/dashboard` with consent metadata present
- Real Google login as a returning/existing-email user links to the same account (no duplicate)
- Cancelling at Google's consent screen lands on `/auth/signin` with a localized error

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Phase 4: UI — Google Sign-In Button

### Overview

A shared button island wired into both auth pages: bare on signin, consent-gated on signup, with localized copy in all three locales.

### Changes Required:

#### 1. Button copy + consent strings (i18n)

**File**: `src/lib/i18n/messages.ts`

**Intent**: Add the Google button label and the signup-side consent affordance copy in all three locales, reusing existing `consent.*` term/link strings where possible.

**Contract**: New keys under `auth` (e.g. `auth.google.button`, and any divider/consent label needed) present in `en`/`pl`/`ru`; passes `messages.test.ts` parity.

#### 2. GoogleSignInButton component

**File**: `src/components/auth/GoogleSignInButton.tsx` (new)

**Intent**: Render the Google button as a form that POSTs to `/api/auth/oauth/google`; on signup, include its own consent checkbox with client-side validation that blocks submit until checked.

**Contract**: Props include `locale`, `intent: "signin" | "signup"`. Renders a `<form method="POST" action="/api/auth/oauth/google">` with a hidden `intent` field. For `intent === "signup"`: render a `ConsentCheckbox` (reuse `src/components/auth/ConsentCheckbox.tsx`) bound to a `consent` field and prevent submit when unchecked (mirror `SignInForm` validation). Uses `SubmitButton`/existing button styling for visual consistency.

#### 3. Wire into auth pages

**File**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`

**Intent**: Place the Google button in each card, with a visual divider relative to the existing email/password form.

**Contract**: Import and render `<GoogleSignInButton locale={locale} intent="signin"|"signup" client:only="react" />` within the form card; signup passes `intent="signup"` (consent-gated), signin passes `intent="signin"`.

### Success Criteria:

#### Automated Verification:

- i18n parity test passes: `npm test`
- Type check: `npx astro check`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Google button renders on both `/auth/signin` and `/auth/signup`
- On signup, the button cannot start OAuth until the consent checkbox is checked
- Button copy is correct in en/pl/ru via the language switcher

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Phase 5: Tests & Docs

### Overview

Lock in regression coverage for what's deterministic — button rendering and redirect initiation — and document the new flow for E2E contributors.

### Changes Required:

#### 1. E2E: buttons render + redirect initiates

**File**: `e2e/oauth-google.spec.ts` (new)

**Intent**: Assert both auth pages show the Google button and that clicking initiates the OAuth redirect, mocking the provider hop so the test never reaches Google.

**Contract**: Anonymous storageState (opt out like `e2e/auth-redirect.spec.ts`). Use `getByRole('button', { name: /Google/ })` (English default locale). Intercept the start endpoint or the Google redirect with `page.route` and assert the navigation/redirect is initiated; on signup, assert the button is blocked until the consent checkbox is checked. No `waitForTimeout`; wait on URL/response state.

#### 2. E2E docs

**File**: `e2e/README.md`

**Intent**: Document the Google OAuth button locators, the redirect-mock seam, and that the real Google round-trip is manual-only.

**Contract**: New subsection covering accessible names, the `page.route` mock for the provider hop, and the manual-verification note.

### Success Criteria:

#### Automated Verification:

- E2E passes with local Supabase up: `npm run db:start` → `npm run test:e2e`
- Full unit suite green: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- E2E spec is stable across re-runs (no flakiness)
- `e2e/README.md` accurately describes the new locators and mock seam

**Implementation Note**: Pause for manual confirmation after automated verification passes.

---

## Testing Strategy

### Unit Tests:

- Start endpoint: consent gating, cookie set/skip by intent, redirect targets, Supabase-null handling.
- Consent-cookie helper: sign/verify round-trip, tamper rejection, clear.
- Callback: new-vs-returning branching, consent stamp, consent-missing bounce, funnel emit (new only), error mapping, cookie cleanup in every branch.
- i18n: `messages.test.ts` and `auth-errors.test.ts` parity for new keys/codes.

### Integration / E2E Tests:

- Both buttons render; signup button blocked until consent checked; click initiates the OAuth redirect (provider hop mocked).

### Manual Testing Steps:

1. With real Google credentials in local Supabase, click "Continue with Google" on `/auth/signup` (consent checked) → completes login → `/dashboard`; verify `consent_version`/`consent_accepted_at` in user metadata and one `funnel_signup_completed{method:"google"}` event.
2. Sign out, click Google on `/auth/signin` → returns to same account, no duplicate, no new funnel event.
3. Create a password account, then Google-login with the same email → lands on the same account (auto-link).
4. Cancel at Google's consent screen → `/auth/signin` with localized error.
5. Switch locale to pl/ru → button + error copy correct.

## Performance Considerations

Negligible: two added redirect hops on an interactive auth path. The funnel emit is fire-and-forget like the existing pattern; keep it off the response critical path.

## Migration Notes

No schema/data migration. Consent for new Google accounts is stored in Supabase user metadata, consistent with the password flow. Existing accounts are unaffected; auto-linking is a Supabase runtime behavior, not a data change.

## References

- Change folder: `context/changes/google-signin-linking/`
- Consent stamping pattern: `src/pages/api/auth/signup.ts:14-39`
- Error classification + i18n: `src/lib/i18n/auth-errors.ts`, `src/lib/i18n/messages.ts`
- Funnel emit pattern: `src/lib/observability/funnel.ts`, `src/lib/observability/identity.ts`
- Config stub pattern: `supabase/config.toml:305` (`[auth.external.apple]`)
- E2E conventions: `e2e/README.md`, `e2e/auth-redirect.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Supabase Config & Secrets

#### Automated

- [x] 1.1 Local Supabase starts with the new config: `npm run db:start`
- [x] 1.2 Lint passes: `npm run lint`

#### Manual

- [x] 1.3 `.env.example` documents both Google env vars
- [x] 1.4 With real Google credentials set, the local provider is reachable (no config parse errors)

### Phase 2: OAuth Start Endpoint & Consent Cookie

#### Automated

- [ ] 2.1 Unit tests pass for start endpoint + consent-cookie helper: `npm test`
- [ ] 2.2 Type check: `npx astro check`
- [ ] 2.3 Lint passes: `npm run lint`

#### Manual

- [ ] 2.4 Signup Google form without consent returns to signup with consent error
- [ ] 2.5 Signup with consent issues a redirect to a Google URL

### Phase 3: OAuth Callback Route

#### Automated

- [ ] 3.1 Unit tests pass for callback branches: `npm test`
- [ ] 3.2 i18n parity test passes for the new error code across en/pl/ru: `npm test`
- [ ] 3.3 Type check: `npx astro check`
- [ ] 3.4 Lint passes: `npm run lint`

#### Manual

- [ ] 3.5 Real Google login as new user lands on `/dashboard` with consent metadata present
- [ ] 3.6 Real Google login as returning/existing-email user links to same account (no duplicate)
- [ ] 3.7 Cancelling at Google's consent screen lands on `/auth/signin` with a localized error

### Phase 4: UI — Google Sign-In Button

#### Automated

- [ ] 4.1 i18n parity test passes: `npm test`
- [ ] 4.2 Type check: `npx astro check`
- [ ] 4.3 Lint passes: `npm run lint`
- [ ] 4.4 Build passes: `npm run build`

#### Manual

- [ ] 4.5 Google button renders on both `/auth/signin` and `/auth/signup`
- [ ] 4.6 On signup, the button cannot start OAuth until the consent checkbox is checked
- [ ] 4.7 Button copy is correct in en/pl/ru via the language switcher

### Phase 5: Tests & Docs

#### Automated

- [ ] 5.1 E2E passes with local Supabase up: `npm run db:start` → `npm run test:e2e`
- [ ] 5.2 Full unit suite green: `npm test`
- [ ] 5.3 Lint passes: `npm run lint`

#### Manual

- [ ] 5.4 E2E spec is stable across re-runs (no flakiness)
- [ ] 5.5 `e2e/README.md` accurately describes the new locators and mock seam
