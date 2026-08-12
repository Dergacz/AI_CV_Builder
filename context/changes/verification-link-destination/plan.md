# Verification Link Destination Implementation Plan

## Overview

The confirmation link in the signup email points at `http://localhost:4321`. Every new production
registration therefore dead-ends at the verification step — the exact step S-02 built and S-01 exists
to measure. This plan makes the link land on the deployed app, sign the user in when it can, and tell
them plainly what to do when it can't.

Two independent causes must both be fixed, and only one of them is code (roadmap S-10):

- **Config** — the hosted Supabase project's `Site URL` is still `http://localhost:4321`.
  `supabase/config.toml` configures only the local stack, so this was never carried over. GoTrue
  builds email links from `Site URL`.
- **Code** — `src/pages/api/auth/signup.ts:22-31` calls `signUp` with no `options.emailRedirectTo`,
  so GoTrue has nothing to redirect to *but* `Site URL` — which is also why the link would land on
  the landing page rather than anywhere useful even once the host is corrected.

Research surfaced a third leak the roadmap does not name: `src/pages/api/auth/resend.ts:31` sends the
same confirmation email through `supabase.auth.resend({ type: "signup" })` and is missing the same
option. That is the recovery path S-02 shipped — leaving it out would fix signup while the
"I didn't get the email" path keeps emitting localhost links.

## Current State Analysis

| Fact | Location | Consequence |
| --- | --- | --- |
| `signUp` passes only `options.data` (consent stamp) | `src/pages/api/auth/signup.ts:22-31` | No `emailRedirectTo` ⇒ GoTrue falls back to `Site URL` |
| `resend` passes no `options` at all | `src/pages/api/auth/resend.ts:31` | Resent links inherit the same fallback |
| Request-derived redirect origin already in use | `src/pages/api/auth/oauth/google.ts:34` — `new URL("/auth/callback", context.url)` | An established pattern to copy; no new env var needed |
| `/auth/callback` exchanges the PKCE code and lands on `/dashboard` | `src/pages/auth/callback.ts:32,60` | The exchange mechanics already exist and are proven by the Google flow |
| `callback.ts` carries OAuth consent-stamping logic | `src/pages/auth/callback.ts:37-57` | Irrelevant to email confirmation — a password account is already stamped at signup (`signup.ts:26-29`) |
| A non-allow-listed `redirect_to` is **silently discarded** in favour of `site_url` | documented at `supabase/config.toml:155-159` | The defining failure mode: a fix can read as correct and change nothing |
| Local allow-list covers `/auth/callback` on both hosts | `supabase/config.toml:160-165` | A new path needs new entries here too |
| `/auth/*` is not in `PROTECTED_ROUTES` | `src/middleware.ts:13,39-47` | A new `/auth/confirm` route cannot be bounced by the confirmed-session guard — no redirect loop |
| Funnel step 3 fires on the first authenticated request after confirmation | `src/middleware.ts:34-37` (`trackEmailConfirmedOnce`) | Signing the user in at confirmation time emits step 3 immediately instead of whenever they next log in |
| `/auth/signin` renders `?error=` only, through an allow-listed code set | `src/pages/auth/signin.astro:12-13`, `src/lib/i18n/auth-errors.ts:4-22` | There is no success-notice channel yet; one must be added, with the same allow-list discipline |
| Local `enable_confirmations = false` | `supabase/config.toml` `[auth.email]`, documented `README.md:87-93` | No confirmation email exists locally ⇒ the emailed-link path cannot be exercised by E2E |
| Highest risk row is `R-15`; manual checks run to `M-4` | `context/foundation/test-plan.md:78,122` | This change adds `R-16` and `M-5` |

## Desired End State

A user who signs up on production receives an email whose link opens `https://<prod-host>/auth/confirm`.

- Opened in the **same browser** they signed up in: the code is exchanged, a session is established,
  and they land on `/dashboard` already signed in. Funnel step 3 emits on that request.
- Opened on a **different device** (phone, where the PKCE code verifier cookie does not exist): the
  address is still verified — GoTrue verifies before it redirects — so they land on `/auth/signin`
  with a "your email is confirmed, sign in to continue" notice, not an error.
- An **expired or already-used** link lands on `/auth/signin` with the existing `email_not_confirmed`
  message, which already tells them to resend.
- The **Resend** button on `/auth/confirm-email` produces a link with the same destination.

Verified by: a real signup on production, a real click from the signup browser, and a second real
click from a phone — see `M-5`.

### Key Discoveries

- `new URL("/auth/callback", context.url)` at `src/pages/api/auth/oauth/google.ts:34` is the house
  pattern for redirect origins. Request-derived means local dev, E2E, and production each get the
  right host with zero configuration — and no new deploy secret to forget, which matters given that a
  forgotten piece of hosted config is what caused this defect.
- Supabase's redirect allow-list documentation specifies wildcard semantics (`*`, `**`, with `.` and
  `/` as separators) but does **not** state whether query strings participate in matching. Since the
  failure mode is silent discard, the plan uses a distinct path (`/auth/confirm`) rather than a query
  flag on `/auth/callback`, so one exact allow-list entry suffices and no wildcard is required.
- `exchangeCodeForSession` failing does **not** mean the email is unconfirmed. GoTrue's `/verify`
  endpoint confirms the address and *then* redirects; a failed exchange downstream of that means only
  that this browser lacks the code verifier. Treating it as an error (which `callback.ts:34` would do)
  tells the user the opposite of what happened.
- `src/tests/api/auth-signup.test.ts:33-44` builds its context without a `url` property. Reading
  `context.url` in the route makes that a required field — existing tests need updating, not just new
  ones.

## What We're NOT Doing

- Not adding a `PUBLIC_SITE_URL` (or similar) env var — the origin comes from the request.
- Not touching the Google OAuth flow or `/auth/callback`; S-11 (`google-unavailable-state`) owns the
  other production auth defect.
- Not changing `enable_confirmations` locally — E2E auth depends on auto-confirm (`README.md:87-93`).
- Not adding an E2E spec for the emailed-link path: with local auto-confirm there is no confirmation
  email to click, and a synthesized link would prove nothing about the hosted allow-list.
- Not customizing the Supabase email template, SMTP, or the email's copy.
- Not adding password-reset or magic-link flows (the helper leaves room for them; wiring them is out
  of scope).
- Not changing what `/auth/confirm-email` says or does; only the link it can resend.

## Implementation Approach

One shared helper builds the confirmation redirect from the request origin, and both email-sending
call sites use it. A new `/auth/confirm` route owns the return trip: exchange the code, sign the user
in, and route the two failure shapes to messages that are true. The sign-in page gains a
success-notice channel with the same allow-listed-code discipline its error channel already has.
Everything the code cannot reach — the hosted `Site URL` and redirect allow-list — is corrected in the
dashboard and written down, then proven by a real click, because no test in this repository can
observe it.

## Critical Implementation Details

**Ordering.** The hosted allow-list entry must exist before the deployed code is exercised. If
`https://<prod-host>/auth/confirm` is not allow-listed, GoTrue discards it and falls back to
`Site URL` — the link works (it reaches production) but lands on the landing page with a raw `?code=`,
which is indistinguishable at a glance from a partial success. Phase 3 sequences the dashboard change
before the production click-through for this reason.

**Confirmation is complete before the redirect.** The exchange in `/auth/confirm` establishes a
*session*; it has no bearing on whether the address was verified. Every branch of that route must
assume the email is confirmed unless GoTrue said otherwise via an `error` query param.

## Phase 1: Redirect target and wiring

### Overview

Give both email-sending call sites an `emailRedirectTo`, and build the route it points at.

### Changes Required:

#### 1. Shared redirect builder

**File**: `src/lib/auth/email-redirect.ts` (new)

**Intent**: One place that decides where confirmation emails send people, so the two call sites cannot
drift and a future one (password reset, magic link) inherits the decision.

**Contract**: Exports a function taking the request URL and returning the absolute
`/auth/confirm` URL on that origin. Mirrors `src/pages/api/auth/oauth/google.ts:34`; lives alongside
`src/lib/auth/consent-cookie.ts`.

#### 2. Signup route

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Pass the confirmation destination so GoTrue stops falling back to `Site URL`.

**Contract**: `options.emailRedirectTo` added to the existing `signUp` call at lines 22-31, alongside
the untouched `options.data` consent stamp. The route now reads `context.url`.

#### 3. Resend route

**File**: `src/pages/api/auth/resend.ts`

**Intent**: The resent email must carry the same link as the original.

**Contract**: `supabase.auth.resend` at line 31 gains an `options` object with `emailRedirectTo` from
the same helper. No change to the redirect/status handling below it.

#### 4. Confirmation return route

**File**: `src/pages/auth/confirm.ts` (new)

**Intent**: Complete the confirmation round-trip — sign the user in when this browser can, and route
the two failure shapes to messages that match what actually happened.

**Contract**: `export const prerender = false` and a `GET` handler, shaped like
`src/pages/auth/callback.ts` but with no consent logic. Four outcomes:

| Condition | Destination |
| --- | --- |
| `error` query param present, or no `code` (expired/reused link) | `/auth/signin?error=email_not_confirmed` |
| `createClient` returns null | `/auth/signin?error=auth_unavailable` |
| `exchangeCodeForSession` fails (no verifier — different device) | `/auth/signin?notice=email_confirmed` |
| Exchange succeeds | `/dashboard` |

#### 5. Local allow-list

**File**: `supabase/config.toml`

**Intent**: Keep the local stack able to honour the new destination if someone flips
`enable_confirmations` on locally.

**Contract**: `additional_redirect_urls` (lines 160-165) gains `/auth/confirm` for both
`http://localhost:4321` and `http://127.0.0.1:4321`. The existing comment at lines 155-159 already
explains why exact entries matter; extend it only if the new entries need it.

#### 6. Route contract tests

**File**: `src/tests/api/auth-signup.test.ts`, `src/tests/api/auth-resend.test.ts`,
`src/tests/api/auth-confirm.test.ts` (new)

**Intent**: Lock that both call sites pass a request-derived `/auth/confirm` URL, and that each of the
four `/auth/confirm` outcomes routes where it should — especially that a failed exchange reads as
confirmed, not failed.

**Contract**: Follow `src/tests/api/auth-signup.test.ts`'s `vi.hoisted` + `vi.mock("@/lib/supabase")`
pattern. `makeContext` in the existing signup/resend tests must gain a `url: new URL(...)` field
matching the request; assert the emitted `emailRedirectTo` is derived from that origin rather than
hard-coded.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test`
- New/updated route tests cover: signup passes `emailRedirectTo`, resend passes `emailRedirectTo`, and all four `/auth/confirm` branches

#### Manual Verification:

- With local Supabase up and `enable_confirmations` temporarily on, a local signup email (Inbucket, `http://localhost:54324`) contains a link to `http://localhost:4321/auth/confirm`
- Clicking it in the signup browser lands on `/dashboard`, signed in
- Local config restored to `enable_confirmations = false` afterwards, and `npm run test:e2e` still passes

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 2: "Email confirmed — sign in" notice

### Overview

Give `/auth/signin` a success channel so the cross-device path — signup on a laptop, email opened on a
phone — reads as the success it is.

### Changes Required:

#### 1. Notice code set

**File**: `src/lib/i18n/auth-notices.ts` (new)

**Intent**: Mirror the error-code discipline for success messages: only an allow-listed code renders,
so a query param can never inject text into the banner.

**Contract**: An `authNoticeCodes` tuple (initially `email_confirmed`), an `AuthNoticeCode` type, a
type guard, and a `getAuthNoticeMessage(locale, code)` reader — structurally the same as
`src/lib/i18n/auth-errors.ts:4-37`, minus the `classify*` mapping (there is no provider error to
classify).

#### 2. Message catalogs

**File**: `src/lib/i18n/messages.ts`

**Intent**: Copy for the new notice in all three locales.

**Contract**: `auth.notices: Record<AuthNoticeCode, string>` added to the `auth` block of the messages
type (near `errors` at line 244) and to the `en`, `pl`, and `ru` catalogs. The key-path parity test
(`src/lib/i18n/messages.test.ts`, R-08) fails on any locale left out.

#### 3. Sign-in page rendering

**File**: `src/pages/auth/signin.astro`

**Intent**: Render the notice above the form, visually distinct from the error banner.

**Contract**: Read `?notice=`, resolve through the type guard (unknown ⇒ render nothing), and display
in a success-styled banner mirroring the shape of `ServerError`
(`src/components/auth/ServerError.tsx`) in the affirmative palette. Astro-side markup — no change to
the `SignInForm` React island.

#### 4. Notice resolver test

**File**: `src/lib/i18n/auth-notices.test.ts` (new)

**Intent**: Prove unknown values are rejected rather than rendered.

**Contract**: Follows `src/lib/i18n/auth-errors.test.ts`; asserts the guard rejects arbitrary strings
and that each code resolves to a non-empty message in every locale.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Unit tests pass: `npm run test` — including locale parity (`src/lib/i18n/messages.test.ts`) and the new notice-resolver test

#### Manual Verification:

- `/auth/signin?notice=email_confirmed` shows the success banner in en, pl, and ru
- `/auth/signin?notice=<garbage>` renders no banner and no raw text
- `/auth/signin?error=signin_failed` still renders the error banner unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause for
manual confirmation before proceeding.

---

## Phase 3: Hosted configuration, documentation, and production proof

### Overview

Correct the half of the defect that lives outside the repository, write it down so it is not lost
again, and prove the whole thing with a real click.

### Changes Required:

#### 1. Hosted Supabase configuration (dashboard — operator action)

**File**: none — hosted Supabase dashboard, **Authentication → URL Configuration**

**Intent**: Stop GoTrue from building email links against `localhost`, and allow-list the new
destination so `emailRedirectTo` is honoured instead of silently discarded.

**Contract**: `Site URL` set to the production origin. Redirect allow-list contains the exact
production URLs for `/auth/confirm` and `/auth/callback`. Must be done **before** the production
click-through below.

#### 2. Operations documentation

**File**: `README.md`

**Intent**: Record the hosted settings this app depends on, next to the existing local-confirmation
note, so the next deploy target does not repeat the defect.

**Contract**: Extend the "Email confirmation in local development" section (lines 87-93) — or add a
production sibling to it — naming the two dashboard fields, the two exact URLs to allow-list, and the
silent-discard behaviour that makes a missing entry hard to spot. Cross-reference the Google OAuth
section at line 176, which documents the same class of dashboard-only setting.

#### 3. Risk register and manual check

**File**: `context/foundation/test-plan.md`

**Intent**: Give this failure mode a named risk, and write the only verification that can actually
observe it.

**Contract**: A new `R-16` row in the risk table (after `R-15`, line 78) — "the emailed confirmation
link points somewhere the user cannot reach" — with its coverage listed as the route contract tests
plus manual `M-5`, and the reason the automated layer is insufficient. A new `M-5` entry in the Manual
verification section (after `M-4`, line 122) scripting the production run below.

#### 4. Roadmap status

**File**: `context/foundation/roadmap.md`

**Intent**: Close S-10.

**Contract**: `S-10` status `todo` → `done` in both the slice table and the S-10 section; `updated`
frontmatter bumped. Record in the S-10 section that the resend path was also fixed and that the
destination is `/auth/confirm` rather than `/auth/signin` as originally sketched, with the
allow-list-matching reason.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Full suite passes: `npm run test`
- Production build succeeds: `npm run build`

#### Manual Verification (M-5):

- Hosted `Site URL` and redirect allow-list updated and screenshotted/noted before deploy
- On production: sign up with a fresh real address; the received email's link points at
  `https://<prod-host>/auth/confirm` — no `localhost`, no landing-page URL
- Clicking it in the signup browser lands on `/dashboard`, signed in
- A second signup, with the email opened on a phone: lands on `/auth/signin` showing the
  "email confirmed" notice; signing in there works
- Resend from `/auth/confirm-email` produces a link with the same destination
- Clicking an already-used link lands on `/auth/signin` with the `email_not_confirmed` message
- PostHog shows funnel step 3 (`email_confirmed`) for the completed signups

---

## Testing Strategy

### Unit Tests

- `src/tests/api/auth-signup.test.ts` — `emailRedirectTo` is present and derived from the request
  origin (not a hard-coded host); the existing consent-stamp and funnel assertions still hold.
- `src/tests/api/auth-resend.test.ts` — same option on the resend call; existing rate-limit and error
  redirects unchanged.
- `src/tests/api/auth-confirm.test.ts` — the four branches, with the failed-exchange case asserting
  `notice=email_confirmed` and specifically *not* an error code.
- `src/lib/i18n/auth-notices.test.ts` — unknown notice values are rejected.
- `src/lib/i18n/messages.test.ts` (existing, R-08) — catches any locale missing the new key.

### Integration Tests

None. The seam that fails here is the hosted allow-list, which no in-repo layer can observe.

### E2E

Deliberately none — see "What We're NOT Doing". R-16's coverage column states this explicitly so the
gap is a recorded decision rather than an oversight.

### Manual Testing Steps

`M-5` in `context/foundation/test-plan.md`, reproduced as Phase 3's manual criteria above.

## Performance Considerations

None. One additional route that runs a single `exchangeCodeForSession`, on a path each user hits once.

## Migration Notes

Accounts that signed up before this change and never confirmed still hold GoTrue links pointing at
`localhost`; those links cannot be repaired retroactively. Once the hosted `Site URL` is corrected,
such a user recovers by requesting a new email through **Resend** on `/auth/confirm-email` — which is
precisely why the resend path is in scope here.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-10 (causes, risk, prod-defect provenance)
- Prior change this completes: `context/changes/enforce-email-verification/plan.md`
- Redirect-origin pattern to copy: `src/pages/api/auth/oauth/google.ts:34`
- Exchange + redirect shape to mirror: `src/pages/auth/callback.ts:19-35`
- Silent-discard behaviour: `supabase/config.toml:155-159`
- Lesson on silent, config-shaped failures: `context/foundation/lessons.md` — "A file's directory can
  be an implicit deployment decision"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Redirect target and wiring

#### Automated

- [x] 1.1 Type checking passes (`npx astro sync && npx astro check`) — edfb283
- [x] 1.2 Linting passes (`npm run lint`) — edfb283
- [x] 1.3 Unit tests pass (`npm run test`) — edfb283
- [x] 1.4 Route tests cover signup/resend `emailRedirectTo` and all four `/auth/confirm` branches — edfb283

#### Manual

- [x] 1.5 Local email link points at `http://localhost:4321/auth/confirm` — edfb283
- [x] 1.6 Clicking it in the signup browser lands on `/dashboard`, signed in — edfb283
- [x] 1.7 Local config restored to `enable_confirmations = false`; `npm run test:e2e` passes — edfb283

### Phase 2: "Email confirmed — sign in" notice

#### Automated

- [x] 2.1 Type checking passes (`npx astro sync && npx astro check`) — 40e601b
- [x] 2.2 Linting passes (`npm run lint`) — 40e601b
- [x] 2.3 Unit tests pass, including locale parity and the notice-resolver test — 40e601b

#### Manual

- [x] 2.4 Notice renders in en, pl, and ru — 40e601b
- [x] 2.5 Unknown `?notice=` value renders nothing — 40e601b
- [x] 2.6 Existing `?error=` banner unchanged — 40e601b

### Phase 3: Hosted configuration, documentation, and production proof

#### Automated

- [x] 3.1 Linting passes (`npm run lint`)
- [x] 3.2 Full suite passes (`npm run test`)
- [x] 3.3 Production build succeeds (`npm run build`)

#### Manual

- [x] 3.4 Hosted `Site URL` and redirect allow-list updated before deploy
- [x] 3.5 Production email link points at `https://<prod-host>/auth/confirm`
- [x] 3.6 Same-browser click lands on `/dashboard`, signed in
- [x] 3.7 Second-device click lands on `/auth/signin` with the confirmed notice, and sign-in works
- [x] 3.8 Resend produces a link with the same destination
- [x] 3.9 Already-used link shows the `email_not_confirmed` message
- [x] 3.10 PostHog shows funnel step 3 for the completed signups
