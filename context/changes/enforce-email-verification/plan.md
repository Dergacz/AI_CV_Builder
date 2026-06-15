# Enforce Email Verification Implementation Plan

## Overview

Enforce that users cannot reach protected content (`/dashboard`, `/cv`) until their email is verified. Enforcement is **config-independent** (a middleware guard on `email_confirmed_at`), backed by a clear signin experience when Supabase rejects an unconfirmed login and a self-serve "resend confirmation" path. Local/dev and E2E keep auto-confirm; production turns confirmations on via the hosted dashboard (documented ops step).

## Current State Analysis

- **Middleware gates on session presence only.** `src/middleware.ts:40-44` checks `context.locals.user` for `PROTECTED_ROUTES = ["/dashboard", "/cv"]` but never inspects `user.email_confirmed_at`. A user with a session but an unverified email passes the gate.
- **Signup already handles the "no session" branch.** `src/pages/api/auth/signup.ts:25-29` redirects to `/dashboard` when `data.session` exists, else to `/auth/confirm-email`. The unhandled case is "session issued for an unconfirmed user."
- **Signin collapses all non-rate-limit errors to a generic message.** `src/pages/api/auth/signin.ts:16` and `classifyAuthError` (`src/lib/i18n/auth-errors.ts`) map everything except 429/rate_limit to the fallback `signin_failed` ("check your email and password") — misleading for Supabase's `email_not_confirmed` error.
- **`email_confirmed_at` is already available at the enforcement point.** `src/middleware.ts:15` resolves `context.locals.user` (a Supabase `User`), and `src/lib/observability/funnel.ts:36` already reads `user.email_confirmed_at`. No new data plumbing needed.
- **Local Supabase has confirmations OFF.** `supabase/config.toml` → `[auth.email] enable_confirmations = false`. Signup auto-confirms and returns a session. Production confirmation is governed by the hosted dashboard, NOT this file — so code-level enforcement cannot rely on config.
- **E2E auth depends on auto-confirm.** `e2e/auth.setup.ts` and `e2e/fixtures/test-user.ts` sign up/sign in a durable test user and rely on `enable_confirmations = false` (no inbox in CI). Turning confirmations on locally would break E2E auth — so local stays auto-confirm.
- **i18n is centralized and triple-locale.** `src/lib/i18n/messages.ts` carries `en` / `pl` / `ru` blocks; `auth.errors` is a `Record<AuthErrorCode, string>` (`src/lib/i18n/auth-errors.ts:1-7`). Any new error code must be added to the union AND all three locale blocks or types break.
- **Confirm-email page copy shape.** `confirmEmail.{autoConfirmed,emailConfirmation}` are `ConfirmEmailStateCopy` ({ title, eyebrow, description, linkText }) — `src/lib/i18n/messages.ts:255-268`. The page (`src/pages/auth/confirm-email.astro`) currently picks copy via `isAutoConfirmed = import.meta.env.DEV`.

## Desired End State

- An authenticated user whose `email_confirmed_at` is null is redirected to `/auth/confirm-email?email=<their-email>` whenever they request a protected route — verified by a unit test of the guard and by manual check in an env where confirmations are on.
- A user who tries to sign in before confirming (when confirmations are on) sees a dedicated "please verify your email" message with a working **Resend confirmation email** action — not the generic "wrong password" message.
- `POST /api/auth/resend` re-sends the Supabase confirmation email for a given address and returns the user to `/auth/confirm-email` with a success/error notice.
- Local dev and E2E continue to work unchanged (auto-confirm), and the production enablement step is documented.

### Key Discoveries:

- Enforcement point already has `user.email_confirmed_at` (`src/middleware.ts:15`, `src/lib/observability/funnel.ts:36`).
- `/auth/confirm-email` is NOT in `PROTECTED_ROUTES`, so redirecting unconfirmed users there cannot loop.
- `classifyAuthError` is the single chokepoint for mapping Supabase errors to UI codes (`src/lib/i18n/auth-errors.ts:18`).
- The funnel `email-confirmed` emit (`src/middleware.ts:28-38`) only fires when `email_confirmed_at` is set, so the new guard (which acts when it is null) cannot collide with it.

## What We're NOT Doing

- **Not** migrating/backfilling or force-re-verifying users already created as unconfirmed — enforcement applies going forward.
- **Not** customizing confirmation email templates or wiring production SMTP — ops/dashboard concern.
- **Not** flipping the production `enable_confirmations` toggle via code — it is a documented hosted-dashboard step.
- **Not** touching password-reset, OAuth, or other auth flows — only email-confirmation gating.
- **Not** changing local `supabase/config.toml` (`enable_confirmations` stays `false`) — keeps E2E auth intact.

## Implementation Approach

Two enforcement layers plus recovery UX:

1. **Middleware guard (primary, config-independent):** extend the existing `PROTECTED_ROUTES` check to also require `email_confirmed_at`, redirecting unconfirmed sessions to the confirm-email page.
2. **Signin classification (secondary):** map Supabase's `email_not_confirmed` to a dedicated UI error code so the message is honest and a resend link can be shown.
3. **Resend recovery:** a small endpoint + a button on the confirm-email page so a user who lost the email can self-serve.

`email` is threaded as a `?email=` query param from all three entry points (signup redirect, middleware block, signin error) so the resend action always knows the address.

## Critical Implementation Details

- **Ordering in middleware:** the email-confirmed check must run inside the existing `PROTECTED_ROUTES` branch, AFTER the `!user` redirect (an unconfirmed user still has a `user` object). The funnel emit block above it is unaffected because it only acts when `email_confirmed_at` is set.
- **Supabase resend contract:** `supabase.auth.resend({ type: "signup", email })`. It is rate-limited (`[auth.rate_limit] email_sent = 2/hour`, `[auth.email] max_frequency = "1s"`); treat a 429 as the existing `rate_limited` code rather than a hard failure.
- **No redirect loop:** `/auth/confirm-email` and `/api/auth/resend` are not protected routes, so a blocked unconfirmed user can still reach them.

## Phase 1: Middleware Enforcement Guard

### Overview

Block protected routes for authenticated-but-unconfirmed users, redirecting them to the confirm-email page with their email attached.

### Changes Required:

#### 1. Middleware protected-route guard

**File**: `src/middleware.ts`

**Intent**: Inside the existing `PROTECTED_ROUTES` branch, after the unauthenticated redirect, add a check that redirects users whose `email_confirmed_at` is null/absent to the confirm-email page, carrying their email so the page's resend action works.

**Contract**: Within the `if (PROTECTED_ROUTES.some(...))` block: when `context.locals.user` exists but `!context.locals.user.email_confirmed_at`, return `context.redirect("/auth/confirm-email?email=" + encodeURIComponent(user.email ?? ""))`. The existing `!user` → `/auth/signin` redirect and the funnel emit above remain unchanged.

#### 2. Guard unit test

**File**: `src/middleware.test.ts` (new)

**Intent**: Lock the three enforcement outcomes so a future refactor can't silently drop the email check.

**Contract**: Mock `createClient` / `safeGetUser` (mirror the mock seam in `src/pages/api/auth/signup.test.ts`). Assert: (a) confirmed user on `/dashboard` → passes to `next()`; (b) unconfirmed user (`email_confirmed_at: null`) on `/cv` → 302 to `/auth/confirm-email?email=...`; (c) no user on `/dashboard` → 302 to `/auth/signin`; (d) any user on a non-protected route → passes through.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (astro check) / `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- New guard test covers confirmed / unconfirmed / no-session / non-protected cases

#### Manual Verification:

- With confirmations on (or a hand-nulled `email_confirmed_at`), hitting `/dashboard` redirects to `/auth/confirm-email` with the email in the URL
- A confirmed user still reaches `/dashboard` and `/cv` normally
- No redirect loop on `/auth/confirm-email`

**Implementation Note**: After automated verification passes, pause for human confirmation of the manual checks before proceeding.

---

## Phase 2: Signin `email_not_confirmed` Handling

### Overview

Give an unconfirmed signin attempt an honest, actionable message instead of the generic "wrong password," and carry the email forward for resend.

### Changes Required:

#### 1. New auth error code

**File**: `src/lib/i18n/auth-errors.ts`

**Intent**: Add `email_not_confirmed` to the auth-error union and map Supabase's corresponding error to it in `classifyAuthError`.

**Contract**: Append `"email_not_confirmed"` to `authErrorCodes`. In `classifyAuthError`, after the rate-limit check, return `"email_not_confirmed"` when `error.code === "email_not_confirmed"` (Supabase's code). Existing fallthrough to the `fallback` is preserved.

#### 2. i18n strings (3 locales)

**File**: `src/lib/i18n/messages.ts`

**Intent**: Add the `email_not_confirmed` message to each locale's `auth.errors` record so the type stays exhaustive.

**Contract**: Add `email_not_confirmed: <string>` to the `errors` block in `en`, `pl`, and `ru`. Copy conveys "your email isn't verified yet — check your inbox or resend." (Type `Record<AuthErrorCode, string>` enforces all three.)

#### 3. Signin redirect threads email

**File**: `src/pages/api/auth/signin.ts`

**Intent**: When signin fails, include the submitted email in the redirect so the signin page (and any resend affordance) can use it.

**Contract**: Change the error redirect to `/auth/signin?error=${code}&email=${encodeURIComponent(email)}`. `code` continues to come from `classifyAuthError(error, "signin_failed")`.

#### 4. Classifier test update

**File**: `src/lib/i18n/auth-errors.test.ts`

**Intent**: Lock the new mapping.

**Contract**: Add a case asserting `classifyAuthError({ code: "email_not_confirmed" }, "signin_failed") === "email_not_confirmed"`, and that an unrelated error still returns the fallback.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check` (exhaustive `errors` record compiles)
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Classifier test asserts the `email_not_confirmed` mapping and fallback

#### Manual Verification:

- With confirmations on, signing in before confirming shows the dedicated message (not "wrong password")
- The signin URL carries `&email=` after the failed attempt
- pl / ru locales render their translated strings

**Implementation Note**: After automated verification passes, pause for human confirmation before proceeding.

---

## Phase 3: Resend Confirmation Flow

### Overview

Let a user re-send the confirmation email from the confirm-email page (the landing spot for both post-signup and middleware-blocked users).

### Changes Required:

#### 1. Resend endpoint

**File**: `src/pages/api/auth/resend.ts` (new)

**Intent**: POST endpoint that re-sends the Supabase signup confirmation email for the submitted address and redirects back to the confirm-email page with a status notice.

**Contract**: `export const POST` (and `const prerender = false`). Read `email` from form data; `createClient(...)` (null → redirect `/auth/confirm-email?status=unavailable`). Call `supabase.auth.resend({ type: "signup", email })`. On error, classify via `classifyAuthError` and redirect `/auth/confirm-email?email=...&status=error` (or `&error=rate_limited` for 429). On success redirect `/auth/confirm-email?email=...&status=sent`. Validate `email` with zod (non-empty email) per repo convention.

#### 2. Resend UI + status on confirm-email page

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Render a "Resend confirmation email" form (POST to `/api/auth/resend`, hidden email field from the `?email=` param) and a success/error notice from `?status=`.

**Contract**: Read `email` and `status` from `Astro.url.searchParams`. Show the resend `<form method="POST" action="/api/auth/resend">` with a hidden `email` input and a submit button using the new i18n copy. Render a notice when `status` is `sent` / `error` / `unavailable`. Keep the existing `autoConfirmed` vs `emailConfirmation` copy selection; the resend block shows on the `emailConfirmation` (verification-pending) state.

#### 3. i18n copy for resend (3 locales)

**File**: `src/lib/i18n/messages.ts`

**Intent**: Add resend button + notice strings to the `confirmEmail` block for all three locales.

**Contract**: Extend the `confirmEmail` copy (or its `emailConfirmation` `ConfirmEmailStateCopy`) with `resendButton`, `resendSent`, `resendError` strings in `en` / `pl` / `ru`. Update the `ConfirmEmailStateCopy` / `confirmEmail` type in the interface to include the new fields so all locales stay exhaustive.

#### 4. Resend endpoint test

**File**: `src/pages/api/auth/resend.test.ts` (new)

**Intent**: Lock the success and error redirects.

**Contract**: Mock `createClient` (`{ auth: { resend } }`) following `signup.test.ts`. Assert: success → 302 to `/auth/confirm-email?...status=sent`; resend error → redirect carrying an error/status; rate-limit (429) → `error=rate_limited`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- Resend endpoint test covers success / error / rate-limited

#### Manual Verification:

- On `/auth/confirm-email?email=...`, clicking Resend returns with a "sent" notice
- Triggering the resend twice quickly surfaces the rate-limit message, not a crash
- pl / ru locales render translated button + notice copy

**Implementation Note**: After automated verification passes, pause for human confirmation before proceeding.

---

## Phase 4: Ops & Docs

### Overview

Record the production enablement step and the deliberate local auto-confirm decision so the enforcement isn't silently undone or misread as broken locally.

### Changes Required:

#### 1. Document the prod toggle and local stance

**File**: `context/changes/enforce-email-verification/change.md` (Notes) and/or `CLAUDE.md` auth-flow note

**Intent**: State that production must have `enable_confirmations = true` in the hosted Supabase dashboard for end-to-end enforcement, that the middleware guard enforces regardless as defense-in-depth, and that local `supabase/config.toml` intentionally keeps `enable_confirmations = false` so E2E auth (no inbox) keeps working.

**Contract**: A short prose note (no code). Cross-reference `src/middleware.ts` guard and `e2e/auth.setup.ts` rationale.

### Success Criteria:

#### Automated Verification:

- Markdown is present and references the guard + E2E rationale: `ls context/changes/enforce-email-verification/change.md`

#### Manual Verification:

- A reader can tell from the docs why local lets unconfirmed-looking signups through and what prod must be set to

**Implementation Note**: Documentation-only phase; no app behavior changes.

---

## Testing Strategy

### Unit Tests:

- Middleware guard: confirmed → pass, unconfirmed → redirect to confirm-email, no-session → redirect to signin, non-protected → pass.
- `classifyAuthError`: `email_not_confirmed` mapping + fallback preserved + rate-limit precedence.
- Resend endpoint: success / error / rate-limited redirects.

### Integration Tests:

- None new beyond the route-level contract tests above (no DB/schema changes).

### Manual Testing Steps:

1. In an environment with confirmations on (or `email_confirmed_at` nulled), request `/dashboard` → land on `/auth/confirm-email?email=...`.
2. Attempt signin before confirming → dedicated message + email in URL.
3. Click Resend → "sent" notice; rapid second click → rate-limit message.
4. Confirm the email, sign in → reach `/dashboard` and `/cv`.
5. Verify pl / ru render translated strings for the new error + resend copy.

## Performance Considerations

Negligible: the guard adds one field check to an already-resolved `user` object on protected routes; resend is a user-initiated, rate-limited action off the hot path.

## Migration Notes

No schema or data migration. Existing unconfirmed accounts are out of scope (see "What We're NOT Doing"); enforcement applies to access attempts going forward. Production enablement is an ops toggle, not a data migration.

## References

- Middleware enforcement point: `src/middleware.ts:40-44`
- Signup branch already handling no-session: `src/pages/api/auth/signup.ts:25-29`
- Error classification chokepoint: `src/lib/i18n/auth-errors.ts:18`
- `email_confirmed_at` already read: `src/lib/observability/funnel.ts:36`
- Local config (confirmations off): `supabase/config.toml` `[auth.email] enable_confirmations`
- E2E auto-confirm dependency: `e2e/auth.setup.ts`, `e2e/fixtures/test-user.ts`
- Test mock pattern to mirror: `src/pages/api/auth/signup.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Middleware Enforcement Guard

#### Automated

- [x] 1.1 Type checking passes (`npx astro check`)
- [x] 1.2 Linting passes (`npm run lint`)
- [x] 1.3 Unit tests pass (`npm test`)
- [x] 1.4 Guard test covers confirmed / unconfirmed / no-session / non-protected cases

#### Manual

- [x] 1.5 Unconfirmed user hitting `/dashboard` redirects to `/auth/confirm-email?email=...`
- [x] 1.6 Confirmed user still reaches `/dashboard` and `/cv`
- [x] 1.7 No redirect loop on `/auth/confirm-email`

### Phase 2: Signin `email_not_confirmed` Handling

#### Automated

- [ ] 2.1 Type checking passes (exhaustive `errors` record compiles)
- [ ] 2.2 Linting passes (`npm run lint`)
- [ ] 2.3 Unit tests pass (`npm test`)
- [ ] 2.4 Classifier test asserts `email_not_confirmed` mapping and fallback

#### Manual

- [ ] 2.5 Unconfirmed signin shows the dedicated message (not "wrong password")
- [ ] 2.6 Signin URL carries `&email=` after the failed attempt
- [ ] 2.7 pl / ru locales render translated strings

### Phase 3: Resend Confirmation Flow

#### Automated

- [ ] 3.1 Type checking passes (`npx astro check`)
- [ ] 3.2 Linting passes (`npm run lint`)
- [ ] 3.3 Unit tests pass (`npm test`)
- [ ] 3.4 Resend endpoint test covers success / error / rate-limited

#### Manual

- [ ] 3.5 Resend returns with a "sent" notice
- [ ] 3.6 Rapid second resend surfaces the rate-limit message, no crash
- [ ] 3.7 pl / ru locales render translated button + notice copy

### Phase 4: Ops & Docs

#### Automated

- [ ] 4.1 Docs present referencing guard + E2E rationale (`ls context/changes/enforce-email-verification/change.md`)

#### Manual

- [ ] 4.2 Reader can tell why local allows unconfirmed signups and what prod must be set to
