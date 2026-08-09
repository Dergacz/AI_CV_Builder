# Permanent Account Deletion (S-08) Implementation Plan

## Overview

Give a signed-in user a self-service way to permanently delete their account and all associated
data, from a new `/account` page, behind an explicit confirmation (typing their own email address).
Deletion is immediate and irreversible: a server-side Supabase **admin** `deleteUser` call removes
the `auth.users` row, and the `on delete cascade` foreign keys already declared on every app table
remove the rest in the same transaction.

Implements FR-011 / US-03 and the PRD's "Right to erasure" NFR. This is the last remaining Wave A
slice (S-08); every other slice in `context/foundation/roadmap.md` is `done`.

## Current State Analysis

**Erasure is already almost entirely modeled in the schema.** All four user-scoped tables declare
`user_id uuid not null references auth.users (id) on delete cascade`:

| Table                     | Migration                                        | Holds                                         |
| ------------------------- | ------------------------------------------------ | --------------------------------------------- |
| `public.cvs`              | `20260606103740_create_cvs.sql:14`               | CV drafts + questionnaire answer snapshots    |
| `public.subscriptions`    | `20260609132956_create_subscriptions.sql:26`     | dormant entitlement rows                      |
| `public.feedback`         | `20260724194333_create_feedback.sql:15`          | helpful/comment verdicts                      |
| `public.generation_usage` | `20260731124357_create_generation_usage.sql:35`  | append-only generation ledger                 |

The `generation_usage` migration says so explicitly in its header comment (line 22): *"Erasure
(S-08): `on delete cascade` from auth.users drops a user's ledger rows with their account, so
account deletion needs no extra work for this table."* The consent record (`consent_version`,
`consent_accepted_at`) lives in `auth.users` user metadata (`src/pages/api/auth/signup.ts:27`,
`src/pages/auth/callback.ts:50`), not a separate table, so it is removed with the user too. **There
is no `profiles` table** — the PRD's "profile" is the `auth.users` row itself.

**What is missing is the privilege to delete that row.** `src/lib/supabase.ts` constructs only the
anon-key SSR client, and `astro.config.mjs` declares no service-role key. The `generation_usage`
migration states the consequence plainly (line 96): *"the app has no service-role client to bypass
it with"*. Nothing in the product can currently delete an `auth.users` row.

**There is no account-settings surface.** `src/pages/dashboard.astro` is the only signed-in page;
its header carries a language switcher and a sign-out form. `PROTECTED_ROUTES` in
`src/middleware.ts:7` is `["/dashboard", "/cv"]`.

**Analytics is already cookieless and person-profile-free.** Every capture — server
(`src/lib/observability/index.ts:88`) and browser (`src/lib/observability/client.browser.ts:126`) —
sends `$process_person_profile: false`, so PostHog holds no person object. The signed-in
`distinct_id` is `HMAC-SHA256(OBSERVABILITY_ID_SALT, user.id)` (`src/lib/observability/identity.ts:31`).
No email, name, or CV content ever leaves the product (`src/lib/observability/scrub.ts`).

## Desired End State

A signed-in user opens `/account`, reads a clearly-marked danger zone, clicks "Delete account",
types their own email address into a modal, confirms, and is redirected to the landing page with a
"your account and data have been deleted" notice. They can no longer sign in. Their `auth.users`
row, CVs, questionnaire snapshots, feedback, subscription row, generation ledger rows, consent
stamp, and sign-in identities are gone, with no recoverable copy in any store the product controls.

**Verification**: `npm test` green (new contract tests for the route, the admin module, and the
email-match gate); `npm run test:db` green (pgTAP proves the cascade); the Playwright spec proves
the confirmation gate refuses a wrong email; and the manual walkthrough in "Manual Testing Steps"
confirms a real deletion against local Supabase, including that sign-in afterwards fails.

### Key Discoveries:

- Every app table cascades from `auth.users` — deleting that one row **is** the erasure
  (`supabase/migrations/20260731124357_create_generation_usage.sql:22`).
- No service-role client exists today; the app's precedent for privileged work is `security definer`
  functions (`check_generation_quota`, `record_generation`). The user has decided to take the
  **admin API** path instead, with a dedicated rotatable secret key isolated to this code path.
- `safeGetUser` (`src/lib/supabase.ts:38`) already purges poisoned/stale sessions on the next
  request, which is what makes best-effort teardown safe after the delete commits.
- `ConfirmDialog` (`src/components/cv/ConfirmDialog.tsx`) is an existing reusable modal with a focus
  trap, Escape/backdrop cancel, destructive red confirm button, and a `confirmDisabled` prop —
  exactly the gate this feature needs, already used by the saved-CV delete.
- The app sets four cookies outside Supabase's own set: `obs_session` and `obs_confirmed`
  (`src/lib/observability/identity.ts:5`, `src/lib/observability/funnel.ts:3`), `ui_locale`
  (`src/lib/i18n/locales.ts:7`), and the short-lived `oauth_consent`
  (`src/lib/auth/consent-cookie.ts:15`).
- CI (`.github/workflows/ci.yml`) runs `astro check` + lint + `npm test` + build only — **no Supabase
  and no Playwright**. Any DB-backed test must therefore be a local, opt-in suite, exactly like the
  existing E2E suite.
- Copy is trilingual through a single typed `getMessages(locale)` tree
  (`src/lib/i18n/messages.ts`, 1131 lines, en/pl/ru).
- Google sign-in shipped (S-04), so a password-based re-authentication gate would lock out
  Google-only accounts. This is why the confirmation is "type your email".

## What We're NOT Doing

- **No soft delete, grace period, or restore window.** The PRD (FR-011) explicitly rejected a
  delayed/recoverable delete: holding "deleted" data complicates the privacy promise.
- **No data export before deletion.** Not in FR-011; would be its own slice.
- **No PostHog deletion API call.** With `$process_person_profile: false` there is no person object
  to delete, and the HMAC pseudonym's only input — the user id — is destroyed by the deletion
  itself. See "Analytics erasure reasoning" below.
- **No admin/operator-initiated deletion**, no support tooling, no deletion audit log. Self-service
  only. (An audit log would itself be a retained record of a deleted user.)
- **No general-purpose admin client.** The secret key backs exactly one exported function.
- **No `ui_locale` cookie clearing** — a device preference, not personal data; clearing it would
  flip the UI to English at the moment the user reads the confirmation.
- **No account_deleted success event.** Failure reporting only (see Phase 1).
- **No destructive E2E spec.** The suite shares one `storageState` user (`e2e/auth.setup.ts`); a
  spec that really deletes would poison every other spec. Real deletion is verified by pgTAP at the
  DB layer plus the manual checklist.
- **No change to the `/api/cv/*` routes, the CV schema, or any existing table.** This slice is
  additive (PRD: "Additive only").

## Implementation Approach

Three phases, each independently verifiable:

1. **Server path first** — the env var, the isolated admin module, and the API route, fully covered
   by contract tests with a mocked admin client. At the end of this phase deletion works and is
   provable via `curl`/tests; nothing is user-reachable yet.
2. **UI second** — the `/account` page, the confirmation island, the nav link, the post-deletion
   notice, and trilingual copy. At the end of this phase the feature is usable.
3. **Erasure proof + docs last** — pgTAP cascade test, non-destructive Playwright spec, env/README
   documentation, and the privacy-policy paragraph that makes the analytics-erasure claim explicit.

**Isolation of the secret key is structural, not conventional.** One module imports
`SUPABASE_SECRET_KEY` and exports one narrow function; no caller can obtain a raw admin client from
it. An ESLint `no-restricted-imports` zone makes importing that module from anywhere but the
deletion service a lint error, so the blast radius cannot quietly widen later.

## Critical Implementation Details

**Ordering around the commit point.** `admin.deleteUser(userId)` is the point of no return. Every
step before it may abort the request with an error; every step after it is best-effort and must
never turn into a user-facing failure — the data is already gone, so an error screen would tell the
user the opposite of the truth. Concretely: validate → verify session → match email → **delete** →
`signOut()` (may fail; the session it targets belongs to a user that no longer exists) → delete
`obs_session` / `obs_confirmed` → redirect. Wrap the post-delete steps so a throw is reported and
swallowed, not propagated.

**`userId` never comes from the request.** It is read from the session verified by
`safeGetUser(supabase, locals)` inside the route, and the confirmation email is compared against
that same session user's `email` — not against a client-supplied identifier. This is the difference
between a deletion endpoint and an account-deletion vulnerability.

**Analytics erasure reasoning** (must be written down, since the erasure claim rests on it rather
than on a visible delete call): PostHog receives no email, name, or content — only
`HMAC-SHA256(OBSERVABILITY_ID_SALT, user.id)` as `distinct_id` plus scrubbed non-sensitive
properties, with person profiles disabled on every capture. Deleting `auth.users` destroys `user.id`,
the sole input that could regenerate that pseudonym, so the residual events become unlinkable to any
person. Clearing `obs_session` and `obs_confirmed` additionally guarantees the browser does not
continue the deleted user's analytics session.

**Astro redirects from a `fetch()`.** The existing sign-out form posts natively and follows the
route's `context.redirect(...)`. The confirmation island submits via `fetch`, which does *not*
navigate on a 3xx. The route therefore returns JSON and the island performs
`window.location.assign(...)` — matching how the CV routes already return JSON to their islands.

## Phase 1: Privileged deletion path (server)

### Overview

Add the secret key to the env schema, build the isolated admin module, and implement
`POST /api/account/delete` with session-derived identity, an email-match gate, best-effort teardown,
and fail-closed behavior when the key is absent. No user-reachable UI in this phase.

### Changes Required:

#### 1. Environment schema

**File**: `astro.config.mjs`

**Intent**: Declare the new server-only secret so it is typed and readable through `astro:env/server`
like every other secret in the project.

**Contract**: Add `SUPABASE_SECRET_KEY: envField.string({ context: "server", access: "secret", optional: true })`
to `env.schema`. `optional: true` matches every other secret here and is what allows the fail-closed
503 path rather than a boot crash in local dev.

#### 2. Isolated admin module

**File**: `src/lib/supabase-admin.ts` (new)

**Intent**: Be the single place in the codebase that reads `SUPABASE_SECRET_KEY`, and expose only the
one operation account deletion needs. No raw admin client is exported, so no future route can widen
the key's blast radius by importing from here.

**Contract**: Exports exactly two things:

- `isAdminConfigured(): boolean` — true when both `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are
  present and non-empty. Used by the route and by the `/account` page to decide the unavailable
  state.
- `deleteUserAccount(userId: string): Promise<{ ok: true } | { ok: false; error: unknown }>` —
  constructs a request-scoped admin client with `createClient` from `@supabase/supabase-js` (not
  `@supabase/ssr`: this client must carry no cookies and no session) using
  `{ auth: { persistSession: false, autoRefreshToken: false } }`, then calls
  `auth.admin.deleteUser(userId)`. Returns a discriminated result rather than throwing, so the route
  decides the user-facing outcome. Never logs or returns the key.

The `persistSession: false, autoRefreshToken: false` pairing is the non-obvious part — without it
the admin client attempts session storage in a Worker runtime that has none:

```ts
createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

#### 3. Lint fence around the secret

**File**: `eslint.config.js`

**Intent**: Make the "isolated to the account-deletion code path" decision enforceable rather than a
comment someone erodes in six months.

**Contract**: A `no-restricted-imports` rule (or `restrictedImports` zone) banning
`@/lib/supabase-admin` and `./supabase-admin` everywhere, with an override that permits it in
`src/lib/services/account-deletion.ts` and that module's own test file. Message should name the
reason ("the service-role key must stay isolated to the account-deletion path").

#### 4. Account-deletion service

**File**: `src/lib/services/account-deletion.ts` (new)

**Intent**: Hold the deletion sequence and its ordering guarantee in one testable place, keeping the
API route thin and matching the repo's `src/lib/services/` convention.

**Contract**: Exports `confirmationMatches(typed: string, accountEmail: string | undefined): boolean`
— trims and case-folds both sides, returns false for an empty/undefined account email — and
`deleteAccount(deps): Promise<DeleteAccountResult>` where `deps` supplies the verified `userId`,
the account email, the typed confirmation, an injected deleter, an injected teardown callback, and
an injected error reporter. Injection (not direct imports) so the whole sequence is unit-testable
without a live Supabase — the same pattern `cv-generation.ts` uses for its reporter. The result type
distinguishes `ok`, `mismatch`, `not_configured`, and `delete_failed`, so the route maps outcomes to
status codes without re-deriving them.

#### 5. API route

**File**: `src/pages/api/account/delete.ts` (new)

**Intent**: The user-facing endpoint. Verifies the session, enforces the confirmation gate, invokes
the deletion, tears down client state best-effort, and returns JSON the island can act on.

**Contract**: `export const prerender = false;` and an uppercase `POST` handler. Request body is
JSON `{ confirmation: string }` read through `readBoundedJson` (existing helper) and validated with
a zod schema — a bounded string, nothing else; **no user id field exists in the schema**. Responses:

| Status | Body                                                | When                                          |
| ------ | --------------------------------------------------- | --------------------------------------------- |
| 200    | `{ ok: true, redirectTo: "/?deleted=1" }`           | deleted                                       |
| 400    | `{ ok: false, error: "confirmation_mismatch", … }`  | typed email ≠ session email                   |
| 401    | `{ ok: false, error: "session_expired", … }`        | no verified session                           |
| 503    | `{ ok: false, error: "service_unavailable", … }`    | anon client or admin key missing              |
| 500    | `{ ok: false, error: "delete_failed", … }`          | `deleteUser` returned an error                |

`userId` and the comparison email come from `safeGetUser(supabase, context.locals)` only. On success,
before returning: `await supabase.auth.signOut()`, then `context.cookies.delete("obs_session", { path: "/" })`
and `context.cookies.delete("obs_confirmed", { path: "/" })` — each wrapped so a failure is reported
and swallowed rather than converting a completed deletion into a 500.

#### 6. Error locations

**File**: `src/lib/observability/locations.ts`

**Intent**: Add the typed buckets for this surface so a failure is visible without a mistyped string
silently splitting a PostHog bucket (the reason this union is closed).

**Contract**: Extend `ServerErrorLocation` with `"api/account/delete:delete"` (the admin call failed
— the erasure path is broken, our defect) and `"api/account/delete:teardown"` (post-commit teardown
failed). Add `"client:account-delete"` to `ClientErrorLocation` for the island's transport-failure
report in Phase 2. Emit **failures only** — no success event, per the decision that writing a fresh
identified event at the moment we claim to erase the identity would contradict the erasure story.

#### 7. Response types

**File**: `src/types.ts`

**Intent**: Keep the route's response shape shared with the island, as the CV routes already do.

**Contract**: Add `DeleteAccountResponse` as a discriminated union of the success and error shapes
listed in the route table above, alongside the existing `DeleteCvResponse` and friends.

#### 8. Local/dev configuration

**File**: `.env.example`

**Intent**: Make the new secret discoverable, and record that its absence disables the surface rather
than breaking the app.

**Contract**: Add a commented `SUPABASE_SECRET_KEY=` entry noting: it is the Supabase **secret**
(`sb_secret_…`) / service-role key; it bypasses RLS; it must never be exposed client-side; it is
required only for account deletion; and locally it comes from `npx supabase status`. Mirror into
`.dev.vars` guidance already described in `CLAUDE.md`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- The lint fence rejects an import of `@/lib/supabase-admin` from a scratch file outside the allowed
  paths (verified once, manually, then removed)
- Unit tests pass: `npm test`
- New contract tests cover: unauthenticated → 401; typed email mismatch (including case/whitespace
  variants) → 400 **and no deleter invocation**; missing admin key → 503 and no deleter invocation;
  deleter error → 500 with an `api/account/delete:delete` report; success → 200, `signOut` called,
  both observability cookies deleted; teardown throw → still 200, with an
  `api/account/delete:teardown` report
- A test asserts the request schema has no user-id field, so identity cannot be client-supplied

#### Manual Verification:

- With `SUPABASE_SECRET_KEY` unset, `POST /api/account/delete` returns 503 and deletes nothing
- With the key set from `npx supabase status`, a `curl` against a throwaway local account returns
  200, and the user is gone from Supabase Studio's Auth table

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before proceeding
to the next phase.

---

## Phase 2: `/account` page and confirmation UI

### Overview

Make the feature reachable: a protected `/account` page with a danger zone, a confirmation island
gated on typing the account email, a nav link from the dashboard, the post-deletion notice on the
landing page, and copy in all three locales.

### Changes Required:

#### 1. Route protection

**File**: `src/middleware.ts`

**Intent**: `/account` holds an irreversible control and must be unreachable without a confirmed
session, like `/dashboard`.

**Contract**: Add `"/account"` to `PROTECTED_ROUTES` (line 7). The existing `startsWith` matching and
the `email_confirmed_at` guard then apply unchanged. Note this makes **every** `/account/*` path
protected — which is why the post-deletion confirmation lives at `/?deleted=1` and not under
`/account`.

#### 2. Account page

**File**: `src/pages/account.astro` (new)

**Intent**: The account-settings home the product lacks, initially carrying only the danger zone.

**Contract**: Server-rendered like `dashboard.astro`: pulls `user` and `locale` from `Astro.locals`,
copy from `getMessages(locale).account`, wraps in `Layout`. Shows the signed-in email, a link back to
the dashboard, and a visually distinct danger-zone section listing exactly what deletion removes
(CVs, questionnaire answers, feedback, sign-in identity). Calls `isAdminConfigured()` and passes the
result to the island so an unconfigured deployment renders the disabled "temporarily unavailable"
state instead of a button that would 503.

#### 3. Deletion island

**File**: `src/components/account/DeleteAccountPanel.tsx` (new)

**Intent**: The confirmation gate and the fetch. React because it needs local state; it is the only
interactive part of the page.

**Contract**: Props `{ accountEmail: string; configured: boolean; copy: DeleteAccountCopy }`. Renders
a destructive "Delete account" button that opens `ConfirmDialog` (reused from
`src/components/cv/ConfirmDialog.tsx`) with an email input rendered as the dialog's body content —
this requires widening `ConfirmDialog`'s `body` prop from `string` to `ReactNode`, which is
backwards-compatible with both existing call sites. `confirmDisabled` stays true until the trimmed,
case-folded input equals the trimmed, case-folded `accountEmail` (reuse `confirmationMatches` from
the service so the client and server gates cannot diverge). On confirm: `POST /api/account/delete`
with `{ confirmation }`, then `window.location.assign(response.redirectTo)` on success; on a non-ok
response show the returned message inline and re-enable the button; on a transport failure call
`reportErrorClient(error, { error_location: "client:account-delete" })` — transport failures only,
since every non-ok response is already reported server-side (the S-07 rule). When `configured` is
false, render the disabled state and no dialog. The input must carry a real `<label>` and the button
an accessible name, per the PRD's accessibility property.

#### 4. Dashboard navigation

**File**: `src/pages/dashboard.astro`

**Intent**: Make `/account` discoverable without putting an irreversible control on the busiest
signed-in page.

**Contract**: Add an "Account" link in the header action group (alongside `LanguageSwitcher` and the
sign-out form), styled as the existing secondary link/button. No danger-zone content on the
dashboard itself.

#### 5. Post-deletion notice

**File**: `src/pages/index.astro` (and `src/components/ProductLanding.astro` if the banner belongs in
the component)

**Intent**: Close the loop — the user must be told the deletion succeeded, on a page they can still
reach with no session.

**Contract**: When `Astro.url.searchParams.get("deleted") === "1"`, render a non-dismissible notice
(role="status") above the landing content confirming the account and all data were permanently
deleted. Purely presentational and content-free — it must not emit any observability event and must
not depend on a session.

#### 6. Copy

**File**: `src/lib/i18n/messages.ts`

**Intent**: All new user-facing strings in the existing typed tree, in en/pl/ru.

**Contract**: Add an `account` branch to the messages interface and to all three locale objects:
page title/heading/description, signed-in-as label, back-to-dashboard link, danger-zone heading and
what-gets-removed list, delete button, dialog title/body/email-label/confirm/cancel, the mismatch
hint, the unavailable state, the error messages for each response code, and the landing-page
deleted notice. Also add a `dashboard.accountLink` string for the nav entry. The typed interface
makes a missing translation a compile error.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck` (a missing locale string fails here)
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`
- A test asserts `confirmationMatches` is shared by client and server gates (single import source)
- A test asserts the panel renders the disabled/unavailable state when `configured` is false

#### Manual Verification:

- `/account` redirects to `/auth/signin` when signed out
- The confirm button stays disabled for a wrong email, an empty field, and a near-miss (extra space,
  different case is accepted)
- Escape, backdrop click, and Cancel all close the dialog without deleting
- The whole flow is keyboard-navigable: tab to the button, open, tab to input, type, tab to confirm;
  focus returns to the trigger on cancel
- Deleting a throwaway local account lands on `/?deleted=1` with the notice, and signing in with
  those credentials afterwards fails
- The page renders correctly in all three locales, including the danger zone and dialog
- With `SUPABASE_SECRET_KEY` unset the page shows the unavailable state and no clickable delete

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before proceeding
to the next phase.

---

## Phase 3: Erasure proof and documentation

### Overview

Prove the cascade contract at the database layer, protect the confirmation gate with a
non-destructive browser test, and write down the operational and privacy claims this feature makes.

### Changes Required:

#### 1. pgTAP cascade test

**File**: `supabase/tests/database/account_deletion_cascade.test.sql` (new)

**Intent**: Pin the cascade contract itself. The entire erasure claim rests on `on delete cascade`
being present on every user-scoped table; a future migration that forgets it would silently orphan
personal data with no other test failing.

**Contract**: A pgTAP test that inserts a throwaway `auth.users` row, seeds one row in each of
`public.cvs`, `public.subscriptions`, `public.feedback`, and `public.generation_usage` for that
user, deletes the `auth.users` row, and asserts zero remaining rows in all four tables. Runs inside a
transaction that is rolled back, so it leaves the local database untouched. Should also assert the
count of user-referencing foreign keys in `public` — so a *new* table added later without a cascade
fails this test rather than passing unnoticed.

#### 2. pgTAP enablement and script

**File**: `supabase/config.toml`, `package.json`

**Intent**: Make the DB suite runnable with one command, and keep it out of the CI gate — CI has no
Postgres (`.github/workflows/ci.yml` runs unit tests and build only).

**Contract**: Enable the pgTAP extension for the local stack if not already on, and add
`"test:db": "supabase test db"` to scripts. Document it as requiring `npm run db:start` first,
exactly like the existing E2E suite. Do **not** add it to `ci.yml`.

#### 3. Non-destructive browser spec

**File**: `e2e/account-deletion.spec.ts` (new)

**Intent**: Regression-protect the single control standing between a user and irreversible loss,
without ever confirming a deletion (the suite shares one `storageState` user).

**Contract**: Follows `e2e/README.md` conventions — `getByRole`/`getByLabel` locators, no
`waitForTimeout`, authenticated via the existing `storageState`. Asserts: `/account` renders the
danger zone for a signed-in user; opening the dialog leaves confirm disabled; typing a wrong email
keeps it disabled; typing the account email enables it; Escape and Cancel close the dialog. **The
spec never clicks confirm**, and a comment states why. It also asserts `/account` redirects to
sign-in when unauthenticated (a `storageState: undefined` context, as `auth-redirect.spec.ts`
already does).

#### 4. Operational documentation

**File**: `README.md`, `CLAUDE.md`

**Intent**: The new secret is the highest-privilege value in the project; how to obtain, scope, and
rotate it must not live only in a plan document.

**Contract**: A README section covering: where `SUPABASE_SECRET_KEY` comes from (dashboard for prod,
`npx supabase status` for local), that it bypasses RLS, that it is used by exactly one module
(`src/lib/supabase-admin.ts`, guarded by an ESLint fence), that it is set as a Cloudflare Worker
secret via `wrangler secret put` and never in `astro.config.mjs` defaults, that rotation is
safe because only the deletion path reads it, and that omitting it disables the deletion surface
(503 + unavailable state) rather than breaking the app. Add the `npm run test:db` command and its
local-Supabase prerequisite to `CLAUDE.md`'s Testing section.

#### 5. Privacy policy statement

**File**: `src/pages/privacy.astro` (or the content source it renders, `src/lib/legal/*`)

**Intent**: The analytics-erasure claim rests on a data-protection argument, not on a visible delete
call against PostHog. An argument that is not written down is not defensible.

**Contract**: A deletion paragraph stating: what deletion removes (account, CVs, questionnaire
answers, feedback, sign-in identity, consent record); that it is immediate and permanent with no
recovery period; and that the analytics store never received identifying data — only a salted
one-way pseudonym derived from the account id, with no person profiles — so deleting the account
destroys the only input that could link those records to a person. Update `POLICY_VERSION` in
`src/lib/legal/policy.ts` if the project's convention is to version any policy text change; check
how S-09 handled this before deciding. Mirror the text in all locales the legal pages support.

### Success Criteria:

#### Automated Verification:

- `npm run test:db` passes against a running local stack (`npm run db:start`)
- The cascade test fails if `on delete cascade` is removed from any of the four tables (verify once
  by temporarily editing a migration, then revert)
- `npm run test:e2e` passes, including the new spec
- `npm test`, `npm run lint`, `npm run typecheck` still pass
- `npm run build` succeeds

#### Manual Verification:

- The README section is sufficient for someone to configure the secret in a fresh Cloudflare
  deployment without reading the code
- The privacy policy deletion paragraph reads correctly in every supported locale
- Full end-to-end walkthrough on a fresh throwaway account: sign up → generate and save a CV →
  submit feedback → delete account → confirm sign-in fails, and Supabase Studio shows zero rows for
  that user in all four tables

---

## Testing Strategy

### Unit Tests:

- `confirmationMatches`: exact match, case difference, leading/trailing whitespace, empty input,
  undefined account email, and a near-miss address
- `deleteAccount` service: each result variant (`ok`, `mismatch`, `not_configured`, `delete_failed`)
  with an injected deleter, asserting the deleter is **not** invoked on `mismatch` or
  `not_configured`
- Teardown ordering: a throwing teardown still yields an `ok` result and produces one report
- `isAdminConfigured`: false when either `SUPABASE_URL` or `SUPABASE_SECRET_KEY` is missing or blank

### Integration Tests:

- Route contract tests for all five status codes, with a mocked Supabase client and admin deleter
- Request-schema test proving no client-supplied identity field is accepted
- pgTAP cascade test (Phase 3) as the DB-layer contract
- Playwright confirmation-gate spec (Phase 3), non-destructive

### Manual Testing Steps:

1. `npm run db:start`, put the local secret key in `.env` / `.dev.vars`, `npm run dev`
2. Sign up a throwaway account, generate and save a CV, submit feedback on it
3. Open `/account` — verify the danger zone lists what will be removed
4. Click delete, type a wrong email — confirm stays disabled; press Escape — nothing deleted
5. Reopen, type the correct email, confirm — expect the `/?deleted=1` notice
6. Attempt to sign in with those credentials — expect failure
7. In Supabase Studio, confirm zero rows for that user id in `cvs`, `feedback`, `subscriptions`,
   `generation_usage`, and that the Auth user is gone
8. Check devtools: `obs_session` and `obs_confirmed` cookies are cleared; `ui_locale` survives
9. Unset `SUPABASE_SECRET_KEY`, restart, reload `/account` — expect the unavailable state
10. Repeat steps 3–5 in Polish and Russian

## Performance Considerations

Negligible. Deletion is a single low-frequency request; the cascade is a handful of indexed deletes
(`cvs_user_id_updated_at_idx`, `generation_usage_user_id_created_at_idx` both lead with `user_id`).
The admin client is constructed per-request inside the deletion path only, so no module-level client
is created on the hot path. Failure reports use the existing `scheduleErrorReport` scheduler, which
keeps the PostHog round-trip off the response.

## Migration Notes

**No schema migration is required.** Every table already declares the cascade. Phase 3 adds a *test*
of that schema, not a change to it.

**Rollback**: the feature is additive and self-contained. Reverting means removing `/account`, the
API route, the admin module, and the `SUPABASE_SECRET_KEY` env entry; no data shape changes, so no
data migration is needed either way. Operationally, unsetting `SUPABASE_SECRET_KEY` is an immediate
kill switch — the surface degrades to the unavailable state and the route 503s, with no other part
of the app affected.

**Deployment prerequisite**: `SUPABASE_SECRET_KEY` must be set as a Cloudflare Worker secret before
this ships, or the deletion surface will render unavailable in production. Note that the legally
required erasure surface being unavailable is itself a compliance problem — treat the secret as a
release blocker, not an optional extra.

## References

- Roadmap slice: `context/foundation/roadmap.md:197` (S-08)
- Requirements: `context/foundation/prd-v3.md:255` (FR-011), `:149` (US-03), `:333` ("Right to erasure")
- Cascade already modeled: `supabase/migrations/20260731124357_create_generation_usage.sql:22`
- Privileged-work precedent (and the "no service-role client" note):
  `supabase/migrations/20260731124357_create_generation_usage.sql:96`
- Reusable modal: `src/components/cv/ConfirmDialog.tsx`
- Existing delete route pattern: `src/pages/api/cv/[id].ts:118`
- Stale-session purge that makes best-effort teardown safe: `src/lib/supabase.ts:38`
- Analytics identity model: `src/lib/observability/identity.ts:31`
- Injected-dependency test pattern: `src/lib/services/cv-generation.ts`
- E2E conventions: `e2e/README.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Privileged deletion path (server)

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — 8d1294d
- [x] 1.2 Linting passes: `npm run lint` — 8d1294d
- [x] 1.3 Lint fence rejects an out-of-zone import of `@/lib/supabase-admin` — 8d1294d
- [x] 1.4 Unit tests pass: `npm test` — 8d1294d
- [x] 1.5 Contract tests cover 401 / 400 mismatch / 503 unconfigured / 500 delete failure / 200 success with teardown — 8d1294d
- [x] 1.6 Request schema rejects any client-supplied user identity — 8d1294d

#### Manual

- [x] 1.7 With the key unset, the route returns 503 and deletes nothing — 8d1294d
- [x] 1.8 With the key set, a curl deletion of a throwaway local account returns 200 and the user is gone from Studio — 8d1294d

### Phase 2: `/account` page and confirmation UI

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` (missing locale strings fail here) — 998ae47
- [x] 2.2 Linting passes: `npm run lint` — 998ae47
- [x] 2.3 Unit tests pass: `npm test` — 998ae47
- [x] 2.4 Client and server confirmation gates share a single `confirmationMatches` source — 998ae47
- [x] 2.5 Panel renders the unavailable state when `configured` is false — 998ae47

#### Manual

- [x] 2.6 `/account` redirects to `/auth/signin` when signed out — a9ba8f5
- [x] 2.7 Confirm stays disabled for wrong, empty, and near-miss emails; case/whitespace variants accepted — a9ba8f5
- [x] 2.8 Escape, backdrop click, and Cancel close the dialog without deleting — a9ba8f5
- [x] 2.9 Full flow is keyboard-navigable and focus returns to the trigger on cancel — a9ba8f5
- [x] 2.10 Deleting a throwaway account lands on `/?deleted=1`; subsequent sign-in fails — a9ba8f5
- [x] 2.11 Page and dialog render correctly in en / pl / ru — a9ba8f5
- [x] 2.12 With the key unset, the page shows the unavailable state and no clickable delete — a9ba8f5

### Phase 3: Erasure proof and documentation

#### Automated

- [x] 3.1 `npm run test:db` passes against a running local stack — a9ba8f5
- [x] 3.2 Cascade test fails when `on delete cascade` is removed from any of the four tables — a9ba8f5
- [x] 3.3 `npm run test:e2e` passes, including the new confirmation-gate spec — a9ba8f5
- [x] 3.4 `npm test`, `npm run lint`, `npm run typecheck` still pass — a9ba8f5
- [x] 3.5 `npm run build` succeeds — a9ba8f5

#### Manual

- [x] 3.6 README section suffices to configure the secret in a fresh Cloudflare deployment — a9ba8f5
- [x] 3.7 Privacy policy deletion paragraph reads correctly in every supported locale — a9ba8f5
- [x] 3.8 Full walkthrough on a fresh account leaves zero rows across all four tables — a9ba8f5
