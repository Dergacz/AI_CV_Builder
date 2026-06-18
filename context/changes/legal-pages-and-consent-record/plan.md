# Legal Pages + Consent Record Implementation Plan

## Overview

Finish the scope that roadmap slice **S-09** carved out of the shipped consent gate (**S-03**): make the placeholder `/terms` and `/privacy` links resolve to real content, record an auditable proof-of-consent (accepted policy version + acceptance timestamp) per registration, and surface the legal pages through a global footer.

The consent **gate** (combined required checkbox, client + server enforcement, `consent_required` error, en/pl/ru consent copy) already shipped in `consent-gated-registration`. This plan does **not** touch the gate mechanics — it adds the content the gate links to and the audit record the gate should leave behind.

## Current State Analysis

- **Placeholder links exist, target pages do not.** `src/components/auth/ConsentCheckbox.tsx:38,42` renders `<a href="/terms">` and `<a href="/privacy">`. No `src/pages/terms.astro` or `src/pages/privacy.astro` exists — both links currently 404.
- **Routes are already public.** `src/middleware.ts:7` has `PROTECTED_ROUTES = ["/dashboard", "/cv"]`. `/terms` and `/privacy` are not matched, so they are reachable without auth — correct for legal pages, no middleware change needed.
- **Page pattern is uniform.** Every page (`src/pages/auth/signin.astro` is representative) does `const locale = Astro.locals.locale` → `getMessages(locale)` → extract nested copy → wrap in the single `src/layouts/Layout.astro`. `Layout.astro` provides `<head>`, observability bootstrap, config banners, and ends with `<slot />` — **there is no footer today**.
- **i18n is compile-enforced across en/pl/ru.** `src/lib/i18n/locales.ts` defines `uiLocales = ["en","pl","ru"]`. `src/lib/i18n/messages.ts` keys a parallel nested structure per locale; TypeScript fails the build if any locale omits a field. Consequence: anything added to the typed bundle must be supplied in all three locales. Legal **bodies** must therefore stay **out** of the typed bundle (English-only decision); only **chrome** strings go in.
- **The consent record has a session-independent seam.** `src/pages/api/auth/signup.ts:21` calls `supabase.auth.signUp({ email, password })`. Supabase accepts `options.data` on this call, which writes `raw_user_meta_data` (`user_metadata`) atomically as part of registration. This matters because production runs `enable_confirmations = true` → the signup response has **no session**, so an owner-only RLS insert into a dedicated table would fail (`auth.uid()` is null), and the repo has **no service-role client factory** (`src/lib/services/entitlements.ts:59-60` documents the need but no factory exists). Stamping via `signUp` `options.data` sidesteps both problems.
- **No user-metadata usage today.** Nothing in the repo reads/writes `user_metadata` / `app_metadata` or calls `auth.updateUser({ data })`. This is greenfield.
- **API-route test pattern is established.** `src/pages/api/auth/signup.test.ts` mocks `@/lib/supabase` and `@/lib/observability` via `vi.hoisted`, builds a fake context with `makeContext`, and asserts on the redirect `Location` and mock calls. A consent-stamp assertion fits this exact shape.

### Key Discoveries

- Placeholder links: `src/components/auth/ConsentCheckbox.tsx:38,42` (hardcoded `/terms`, `/privacy`).
- Signup seam for the stamp: `src/pages/api/auth/signup.ts:21` (the `signUp` call).
- Layout with no footer: `src/layouts/Layout.astro` (single shared layout, `<slot />` only).
- i18n bundle + 3-locale enforcement: `src/lib/i18n/messages.ts`, `src/lib/i18n/locales.ts`.
- Prod vs local confirmation: `supabase/config.toml:209` `enable_confirmations = false` (local auto-session); prod sets `true` (no session at signup) per `CLAUDE.md` auth-flow notes.
- Test harness to extend: `src/pages/api/auth/signup.test.ts` (vi.hoisted mocks, `makeContext`).

## Desired End State

- Visiting `/terms` renders a lean Terms of Service draft; visiting `/privacy` renders a Privacy Policy grounded in the app's real data flows — both English-bodied, both showing the current policy version and a "draft pending legal review" notice, both wrapped in the standard `Layout`.
- The consent checkbox links on the signup form navigate to those live pages.
- A global footer on every page links to `/terms` and `/privacy`, with footer copy localized across en/pl/ru.
- Every new registration writes `consent_version` and `consent_accepted_at` into the user's Supabase `user_metadata`, stamped atomically by the `signUp` call — verifiable by inspecting the user in the Supabase dashboard.
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` all pass; a light Playwright E2E confirms the pages resolve and the links navigate.

## What We're NOT Doing

- **Not** changing the consent gate mechanics (checkbox, client/server enforcement, `consent_required` error) — shipped in S-03.
- **Not** translating the legal bodies into pl/ru — English-only this slice (chrome is localized; bodies are not).
- **Not** building a dedicated consent table, a service-role client factory, or any migration — the record lives in `user_metadata`.
- **Not** implementing policy-version change detection or re-consent flows for existing users when the version bumps (future concern).
- **Not** finalizing legal copy — both documents are explicitly drafts pending the data-flow sign-off (Open Q1) and legal review (Open Q2).
- **Not** asserting legal wording in tests — content will churn in review; tests cover the stamp and that pages/links resolve, not prose.
- **Not** making the legal pages tamper-proof audit records — `user_metadata` is a faithful stamp at signup but is technically user-editable later; acceptable for this validation release (a tamper-proof table/app_metadata path was explicitly deferred).

## Implementation Approach

Three independent, sequenced phases:

1. **Consent record stamp** — a `POLICY_VERSION` constant module + a one-line-ish change to the `signUp` call to carry the consent metadata, with a unit test. Isolated, no UI, lands the audit behavior first.
2. **Legal pages** — a shared `LegalDocument` presentation component, the two `.astro` pages (English bodies authored inline, kept out of the typed bundle), and a small localized `legal` chrome section. The placeholder links now resolve.
3. **Global footer + E2E** — a `Footer.astro` with localized `footer` copy wired into `Layout.astro`, plus a Playwright E2E covering page resolution and link navigation.

## Critical Implementation Details

- **The consent stamp must be written by the `signUp` call itself, not a follow-up `updateUser`.** In production there is no session immediately after `signUp` (email confirmation pending), so a separate authenticated write would have no `auth.uid()`. Passing `options.data` to `signUp` is the only path that records consent without a session and without service-role infra. The single date-based `POLICY_VERSION` is the value stamped; `consent_accepted_at` is an ISO-8601 timestamp generated at request time.
- **Legal bodies must not enter `src/lib/i18n/messages.ts`.** The typed bundle's 3-locale enforcement would force pl/ru translations of binding legal text. Author bodies as Astro markup inside the page files; put only chrome strings (titles, "last updated" label, the pending-review notice, the English-content note, footer labels) in the typed bundle.

## Phase 1: Policy version + consent record stamp

### Overview

Introduce the single source of truth for the policy version and stamp it — plus an acceptance timestamp — into each registration's `user_metadata` via the existing `signUp` call. No UI, no schema.

### Changes Required:

#### 1. Policy version constant module

**File**: `src/lib/legal/policy.ts` (new)

**Intent**: One source of truth for the current combined Terms+Privacy policy version and its human-readable "last updated" date, imported by both the signup stamp (Phase 1) and the legal pages (Phase 2).

**Contract**: Export `POLICY_VERSION` as a date-based string constant (e.g. `"2026-06-18"`) and a `POLICY_LAST_UPDATED` display value derived from / equal to it. No logic, no dependencies. These are the values the consent record stamps and the pages display.

#### 2. Stamp consent metadata on signup

**File**: `src/pages/api/auth/signup.ts`

**Intent**: After the consent gate passes, carry the accepted policy version and an acceptance timestamp into the `signUp` call so they are written to `user_metadata` atomically with account creation — leaving an auditable proof-of-consent.

**Contract**: Change the `supabase.auth.signUp({ email, password })` call (line 21) to `supabase.auth.signUp({ email, password, options: { data: { consent_version: POLICY_VERSION, consent_accepted_at: <ISO-8601 now> } } })`. Import `POLICY_VERSION` from `@/lib/legal/policy`. The consent gate, error handling, funnel emission, and redirect branches are unchanged. The timestamp is generated at request time (`new Date().toISOString()`).

#### 3. Unit test for the stamp

**File**: `src/pages/api/auth/signup.test.ts`

**Intent**: Lock that a successful registration passes the consent version and an ISO timestamp into `signUp`, so the audit stamp can't silently regress.

**Contract**: In the existing success-path test(s), assert `mocks.signUp` was called with an object whose `options.data` contains `consent_version` equal to `POLICY_VERSION` (imported) and `consent_accepted_at` matching an ISO-8601 pattern (`expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)`). The existing `consent: "on"` form fields and redirect assertions stay.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- Registering a new user locally (`npm run db:start` + `npm run dev`), then inspecting the user in the Supabase Studio dashboard, shows `consent_version` and `consent_accepted_at` under user metadata.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Legal pages (Terms + Privacy) + localized chrome

### Overview

Author the two legal pages with English bodies and localized chrome, behind a shared presentation component, so the placeholder consent links resolve to real content showing the current policy version and a pending-review notice.

### Changes Required:

#### 1. Shared legal-document presentation component

**File**: `src/components/legal/LegalDocument.astro` (new)

**Intent**: Consistent presentation shell for both legal pages — renders the document title, the current policy version and last-updated date, a "draft pending legal review" notice, an "this document is provided in English" note, and a `<slot />` for the body. Keeps the two pages visually consistent and DRY.

**Contract**: Props `{ title: string; version: string; lastUpdated: string; reviewNotice: string; englishNote: string }`. Renders heading + metadata + notices + `<slot />`. Pure presentation; no data fetching. Styled with Tailwind + `cn()` per project convention.

#### 2. Terms of Service page

**File**: `src/pages/terms.astro` (new)

**Intent**: Resolve the `/terms` placeholder link to a lean, essential-clauses Terms of Service draft.

**Contract**: Standard page shape — `const locale = Astro.locals.locale`; `getMessages(locale)`; import `POLICY_VERSION`, `POLICY_LAST_UPDATED` from `@/lib/legal/policy`. Wrap `LegalDocument` (fed the localized `legal` chrome copy) inside `Layout`. The **body** is English Astro markup authored inline covering: service description, acceptable use, AI-generated-content disclaimer (CV content is AI-assisted, user is responsible for accuracy), no-warranty / as-is, account termination, and a governing-law placeholder. `prerender` not set (SSR default is fine). English body is **not** added to `messages.ts`.

#### 3. Privacy Policy page

**File**: `src/pages/privacy.astro` (new)

**Intent**: Resolve the `/privacy` placeholder link to a Privacy Policy grounded in the application's real data flows, flagged as a draft pending the formal data-flow audit and legal review.

**Contract**: Same page shape as `terms.astro`. The English body, authored inline, discloses the actual flows observable in the codebase: account data via Supabase auth (email/password); CV drafts + questionnaire answers stored in `public.cvs` (Supabase Postgres, owner-only); **AI-assisted generation** (answers sent to an AI provider to generate CV content — FR-005 disclosure requirement); pseudonymous product analytics (PostHog, no raw answer/CV content); cookies/session for auth and locale; data retention and the forthcoming account-deletion right (S-08). Includes the pending-review notice. English body is **not** added to `messages.ts`.

#### 4. Localized chrome copy

**File**: `src/lib/i18n/messages.ts`

**Intent**: Provide the localized non-legal-body strings the pages and `LegalDocument` need, across en/pl/ru, without putting binding legal text into the typed bundle.

**Contract**: Add a `legal` section to the message structure (and its TypeScript interface) carrying: `terms.title`, `privacy.title`, `lastUpdatedLabel`, `versionLabel`, `reviewNotice`, `englishNote`. Supply all three locales (TypeScript enforces completeness). These are short chrome strings only — page titles, labels, and notices — never the policy bodies.

### Success Criteria:

#### Automated Verification:

- Astro types synced: `npx astro sync`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`

#### Manual Verification:

- `/terms` and `/privacy` render with title, version, last-updated, and the pending-review notice.
- The consent checkbox links on `/auth/signup` navigate to the two pages.
- Switching locale (EN/PL/ZH switcher) changes the page chrome (titles/labels) while the body stays English.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Global footer + E2E

### Overview

Add a global footer linking the legal pages on every page, and a light end-to-end test confirming the pages resolve and the links navigate.

### Changes Required:

#### 1. Footer component

**File**: `src/components/Footer.astro` (new)

**Intent**: A site-wide footer linking `/terms` and `/privacy` (and a copyright line), so the legal pages are discoverable everywhere, not only from the signup form.

**Contract**: Accepts the localized `footer` copy (or reads `getMessages(locale)` itself given `locale` prop). Renders `<footer>` with anchors to `/terms` and `/privacy` using the localized labels plus a copyright/rights line. Tailwind-styled per convention.

#### 2. Footer copy

**File**: `src/lib/i18n/messages.ts`

**Intent**: Localized labels for the footer across en/pl/ru.

**Contract**: Add a `footer` section (and its interface) with `termsLabel`, `privacyLabel`, and a `rights` string. All three locales supplied.

#### 3. Wire footer into the layout

**File**: `src/layouts/Layout.astro`

**Intent**: Render the footer on every page below the page content.

**Contract**: Import `Footer` and render it after `<slot />`, passing the current `locale`. No change to existing head/observability/config-banner logic.

#### 4. E2E for legal pages + links

**File**: `e2e/legal-pages.spec.ts` (new)

**Intent**: Guard the headline user-visible outcome — the pages resolve and both entry points (consent links + footer links) navigate to them.

**Contract**: Per `e2e/README.md` conventions and the project E2E rules (role/label/text locators, no `waitForTimeout`, `waitForURL` for navigation, unique/standalone, no auth needed since pages are public): (a) navigate to `/terms` and `/privacy` directly and assert a heading is visible; (b) from `/auth/signup`, click the consent Terms/Privacy links and assert the URL/heading; (c) from any page, click the footer Terms/Privacy links and assert navigation. No assertions on legal body wording.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- E2E passes with local Supabase up: `npm run db:start` → `npm run test:e2e`

#### Manual Verification:

- The footer appears on the landing, auth, and dashboard pages with working `/terms` and `/privacy` links.
- Footer labels change with locale.

**Implementation Note**: After automated verification passes, pause for manual confirmation. This is the final phase.

---

## Testing Strategy

### Unit Tests:

- `signup.test.ts`: a successful registration calls `signUp` with `options.data.consent_version === POLICY_VERSION` and an ISO `consent_accepted_at`; the existing consent-gate and funnel assertions remain green.

### E2E Tests:

- `e2e/legal-pages.spec.ts`: `/terms` and `/privacy` render; consent links and footer links navigate to them. No legal-wording assertions (content is a pending-review draft).

### Manual Testing Steps:

1. Register a new local user; confirm `consent_version` + `consent_accepted_at` appear in Supabase Studio user metadata.
2. Open `/terms` and `/privacy`; confirm version, last-updated, and pending-review notice render.
3. From `/auth/signup`, click both consent links; confirm they land on the right pages.
4. Confirm the footer appears site-wide and its links + labels work across EN/PL/RU.

## Migration Notes

No database migration. The consent record is stored in Supabase `user_metadata`, written by the `signUp` call. Users who registered before this change simply lack the `consent_version`/`consent_accepted_at` keys (the consent gate still applied to them; only the explicit audit stamp is new) — no backfill in scope.

## References

- Roadmap slice: `context/foundation/roadmap.md` → S-09 (and S-03 "Descoped to S-09").
- Predecessor change: `context/changes/consent-gated-registration/` (the shipped gate).
- Placeholder links: `src/components/auth/ConsentCheckbox.tsx:38,42`
- Signup seam: `src/pages/api/auth/signup.ts:21`
- Page pattern: `src/pages/auth/signin.astro`
- i18n: `src/lib/i18n/messages.ts`, `src/lib/i18n/locales.ts`
- Test harness: `src/pages/api/auth/signup.test.ts`
- E2E conventions: `e2e/README.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Policy version + consent record stamp

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm test`

#### Manual

- [x] 1.4 New-user registration shows `consent_version` + `consent_accepted_at` in Supabase Studio user metadata

### Phase 2: Legal pages (Terms + Privacy) + localized chrome

#### Automated

- [ ] 2.1 Astro types synced: `npx astro sync`
- [ ] 2.2 Type checking passes: `npm run typecheck`
- [ ] 2.3 Linting passes: `npm run lint`
- [ ] 2.4 Production build succeeds: `npm run build`

#### Manual

- [ ] 2.5 `/terms` and `/privacy` render with title, version, last-updated, and pending-review notice
- [ ] 2.6 Consent checkbox links on `/auth/signup` navigate to the two pages
- [ ] 2.7 Locale switch changes page chrome while body stays English

### Phase 3: Global footer + E2E

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Production build succeeds: `npm run build`
- [ ] 3.4 E2E passes: `npm run db:start` → `npm run test:e2e`

#### Manual

- [ ] 3.5 Footer appears site-wide with working `/terms` and `/privacy` links
- [ ] 3.6 Footer labels change with locale
