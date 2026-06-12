# Funnel-Event Instrumentation (S-01) Implementation Plan

## Overview

Roadmap slice **S-01 (north star)**: turn the already-working CV-builder funnel into something whose conversion and drop-off can be *seen*. We wire **8 distinct funnel events** — landing → registration → email confirmation → questionnaire started → questionnaire completed → CV generated → CV saved → PDF exported — onto the recording contract that **F-01 (observability-baseline) already built**. The infrastructure (PostHog EU transport, `track()`/`trackClient()`, allowlist scrubber, pseudonymous identity) exists and is proven by the F-01 smoke test; this slice is the integration across the live flow, plus the request-identity plumbing that makes server- and client-emitted events line up into coherent funnels.

## Current State Analysis

The recording contract exists but has **zero production callers** — only the guarded smoke route emits.

- **Server contract** — `track(event, props, identity)` at `src/lib/observability/index.ts:60` accepts a **closed union** `ObservabilityEvent = "observability_smoke" | "observability_error"` (`index.ts:10`). The allowlist scrubber (`src/lib/observability/scrub.ts:3`) passes only 9 keys (`surface, route, status, error_type, error_location, duration_ms, model_provider, locale, success`); everything else is dropped.
- **Client contract** — `trackClient(event, props)` at `src/lib/observability/client.browser.ts:86`, mirror union `ClientObservabilityEvent` (`client.browser.ts:12`). The client is initialized in `src/layouts/Layout.astro:50-53` via an inline module `<script>` calling `initClientObservability()` in **cookieless `persistence: "memory"`** mode with `autocapture:false`, `capture_pageview:false`, and `$process_person_profile:false`.
- **Identity** — `getPseudonymousUserId(userId)` (HMAC-SHA256, stable per user) and `getAnonSessionId(cookies)` (mints/reads the `obs_session` cookie, 2h TTL) live in `src/lib/observability/identity.ts`. **Only the smoke route calls them** (`src/pages/api/observability/smoke.ts:53-55`).
- **Request user** — `src/middleware.ts:13` resolves `context.locals.user` (Supabase `User | null`) on every request; `App.Locals` is typed in `src/env.d.ts`. API routes read `context.locals.user`; cookies are `context.cookies` (Astro `AstroCookies`).
- **The 8 emit points** (from codebase mapping): landing `src/pages/index.astro`→`ProductLanding`; signup `src/pages/api/auth/signup.ts:24` (success redirect); email-confirm `src/pages/auth/confirm-email.astro` (static page, no API — dev auto-confirms); questionnaire start/complete `src/components/cv/QuestionnaireFlow.tsx` (mount / `handleGenerate`); CV generated `src/pages/api/cv/generate.ts:48` (ok branch); CV saved `src/pages/api/cv/index.ts` POST + `src/pages/api/cv/[id].ts` PUT (via `src/components/hooks/useCvSave.ts`); PDF export `src/components/hooks/useCvExport.ts` (`status==="done"`, pure browser, no server round-trip).

## Desired End State

A real user moving landing → signup → confirm → questionnaire → generate → save → export produces **8 distinct, content-free tracked events** in PostHog EU. Because F-01 is deliberately cookieless with no person-profiles, the funnel is read as **two linked segments**: an **anonymous** segment (`landing_viewed` → `signup_completed`, keyed by the `obs_session` anon id) and an **identified** segment (`email_confirmed` → `pdf_exported`, keyed by the pseudonymous user id). Within each segment, server- and client-emitted events share the **same distinct_id** (resolved once per request in middleware and bootstrapped into the client SDK), so the steps connect. The cookieless / `$process_person_profile:false` posture is preserved end-to-end; no raw content or raw user id ever leaves.

**Verification:** walk the flow with PostHog configured; the anonymous funnel and the identified funnel each resolve with the expected step counts and a single distinct_id per user-session. Unit tests prove the new event names are typed, each server call site emits the right event, identity resolves once per request, and the email-confirm event fires at most once.

### Key Discoveries:

- The event unions are **closed** — adding funnel events is a type change in two files (`index.ts:10`, `client.browser.ts:12`), which makes typos compile-errors. (Decision: 8 distinct names.)
- **No new allowlist keys needed** — every metadata field we attach (`locale`, `model_provider`, `duration_ms`, `success`, `surface`) is already in `scrub.ts:3`. (Decision: minimal reused keys.)
- **Distinct_id alignment is the load-bearing mechanism.** posthog-js in `persistence:"memory"` mints a *random* distinct_id per page load (`client.browser.ts:70-76`). Unless the client is bootstrapped with the server-resolved id, the 4 client events and 4 server events of the same user carry different ids and the identified funnel (which spans both) will not connect.
- **Step 3 has no API hook** — `confirm-email.astro` is static and dev auto-confirms (`confirm-email.astro:6`). The reliable signal is Supabase's `email_confirmed_at` on the user, observed on the first authenticated request after confirmation. (Decision: emit once on first authenticated session where the email is confirmed.)
- `signin.ts` (`src/pages/api/auth/signin.ts`) and the middleware both see the authenticated user — the natural home for the once-only `email_confirmed` emit.

## What We're NOT Doing

- **No PostHog `identify`/`alias`** and no re-enabling person profiles — the anon→identified boundary stays unstitched by design (two linked funnels).
- **No failure/abandon events** — drop-off is read as absence of the next step; generation/save *errors* are S-07's job via the existing `reportError` path. (`cv_generated`/`cv_saved` emit only on success.)
- **No new allowlist keys**, no per-event dedup/session bookkeeping (emit every occurrence; PostHog funnels take first-touch per distinct_id).
- **No E2E/Playwright funnel assertions** — F-01 already proved transport; we unit-test the seams and manually verify the funnel.
- No cookie-consent banner (that's S-03), no dashboards, no touching the existing `console.warn` calls or the smoke route guard.

## Implementation Approach

Three phases, foundation-first. **Phase 1** widens the vocabulary (8 event names in both unions) and builds the single mechanism everything else depends on: resolve **one distinct_id per request** in middleware, cache it on `locals`, and thread it into the client SDK init so both sides agree. **Phase 2** wires the 4 server emits in their API success branches, including the once-only `email_confirmed`. **Phase 3** wires the 4 client emits via `trackClient` and verifies the two funnels end-to-end. Each emit is fire-and-forget and must never throw into the user path (the contract already guarantees this) and carries only already-allowlisted metadata.

## Critical Implementation Details

- **Distinct_id threading (server → client).** Astro inline `<script>` modules can't read frontmatter directly. Resolve the request distinct_id in `Layout.astro` frontmatter (from `locals`) and render it onto a DOM attribute (e.g. `data-obs-distinct-id` on `<body>`); the existing init `<script>` reads it via `dataset` and passes it to `initClientObservability({ distinctId })`, which bootstraps posthog-js with `bootstrap: { distinctID }` while keeping `$process_person_profile:false`. This keeps person profiles off but pins the client's distinct_id to the server's. Anonymous requests resolve to the `obs_session` id; authenticated requests to the pseudonymous id — so the client id flips at exactly the same boundary as the server, which is why the two funnels are linked but not stitched.
- **Email-confirm once-only.** The event must fire at most once per user. Anchor it to `user.email_confirmed_at` being present and guard re-fires with a lightweight marker (e.g. a short-lived cookie set when the event is emitted), so a returning confirmed user on every later session does not re-emit. The guard's correctness (fires once, not zero, not every session) is the one piece of real logic to unit-test here.
- **Identity resolved once.** Add a `resolveRequestIdentity(user, cookies)` helper and call it in middleware so every downstream server emit reuses the cached `locals` value rather than recomputing the HMAC per call.

## Phase 1: Foundation — event vocabulary + request identity

### Overview

Extend both event unions with the 8 funnel names, resolve a single distinct_id per request in middleware, and thread it into the client SDK so server and client events share an id. No funnel events are emitted yet.

### Changes Required:

#### 1. Funnel event names (server + client unions)

**File**: `src/lib/observability/index.ts`, `src/lib/observability/client.browser.ts`

**Intent**: Add the 8 funnel event names so call sites are type-checked and typos can't reach PostHog. Keep the two unions in sync.

**Contract**: Extend `ObservabilityEvent` (`index.ts:10`) and `ClientObservabilityEvent` (`client.browser.ts:12`) with the 8 names: `funnel_landing_viewed`, `funnel_signup_completed`, `funnel_email_confirmed`, `funnel_questionnaire_started`, `funnel_questionnaire_completed`, `funnel_cv_generated`, `funnel_cv_saved`, `funnel_pdf_exported`. Consider a shared `FunnelEvent` type alias re-used by both unions to prevent drift.

#### 2. Request identity helper + middleware resolution

**File**: `src/lib/observability/identity.ts`, `src/middleware.ts`, `src/env.d.ts`

**Intent**: Resolve the request's observability distinct_id once (pseudonymous id when authenticated, anon `obs_session` id otherwise) and make it available to all server emit points and to the layout.

**Contract**: New `resolveRequestIdentity(user, cookies): Promise<Identity>` in `identity.ts` (reuses `getPseudonymousUserId` / `getAnonSessionId`, mirroring the smoke route's logic at `smoke.ts:53-55`). Call it in `middleware.ts` after `locals.user` is set; store the result on `locals` (e.g. `locals.observability = { distinctId }`). Add the field to `App.Locals` in `env.d.ts`.

#### 3. Client init accepts a bootstrap distinct_id

**File**: `src/lib/observability/client.browser.ts`, `src/layouts/Layout.astro`

**Intent**: Pin the browser SDK's distinct_id to the server-resolved id so client funnel events line up with server ones, without enabling person profiles.

**Contract**: `initClientObservability(options)` gains an optional `distinctId`; when present, pass `bootstrap: { distinctID }` to `posthog.init` (alongside existing cookieless options, `$process_person_profile:false` unchanged). In `Layout.astro`, render the `locals` distinct_id onto a DOM data attribute and have the existing init `<script>` read it and pass it through. Absent id / unconfigured key remains a safe no-op.

### Success Criteria:

#### Automated Verification:

- Type checking passes (event unions + `App.Locals`): `npm run astro sync && npx astro check`
- Lint passes: `npm run lint`
- Unit tests pass: `npm test`
- `resolveRequestIdentity` returns the pseudonymous id for an authenticated user and the anon-session id otherwise (never the raw user id)
- `initClientObservability({ distinctId })` forwards `bootstrap.distinctID` and still sets `$process_person_profile:false` (extend `client.browser.test.ts`)

#### Manual Verification:

- With PostHog configured, loading any page shows the client SDK adopting the server distinct_id (devtools/network), not a fresh random id
- With PostHog unconfigured, the app runs normally and the config banner still flags it (no regression)

**Implementation Note**: After this phase and all automated verification passes, pause for human confirmation of the manual checks before proceeding.

---

## Phase 2: Server-side funnel emits (4 events)

### Overview

Emit the 4 server-observable funnel events from their API success branches, reusing `locals` identity. Includes the once-only `email_confirmed`.

### Changes Required:

#### 1. Signup completed

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Record that registration succeeded (anonymous segment), at the success branch before email confirmation.

**Contract**: On the success path (`signup.ts:24`, the redirect to `/auth/confirm-email`), `await track("funnel_signup_completed", { locale }, locals.observability)`. Anonymous identity (anon-session id) is expected here. Fire-and-forget; never block or throw into the redirect.

#### 2. Email confirmed (once-only)

**File**: `src/middleware.ts` or `src/pages/api/auth/signin.ts`

**Intent**: Record the first time we observe a user's email as confirmed — the bridge into the identified segment.

**Contract**: When `locals.user.email_confirmed_at` is present and a once-marker is absent, `await track("funnel_email_confirmed", { locale }, locals.observability)` and set the marker (short-lived cookie) so later sessions don't re-emit. Identity is the pseudonymous id. The once-guard is the unit-tested logic.

#### 3. CV generated

**File**: `src/pages/api/cv/generate.ts`

**Intent**: Record a successful AI generation, with coarse performance/segmentation metadata.

**Contract**: On the ok branch (`generate.ts:48-50`, `result.ok === true`), `await track("funnel_cv_generated", { locale, model_provider, duration_ms, success: true }, locals.observability)`. Only emit on success (no event on the error branch). `duration_ms`/`model_provider` are sourced from the generation result/config; all keys already allowlisted.

#### 4. CV saved

**File**: `src/pages/api/cv/index.ts` (POST), `src/pages/api/cv/[id].ts` (PUT)

**Intent**: Record a successful persist. Emit on every successful save (POST and PUT); PostHog funnels take first-touch.

**Contract**: On each success branch (POST 201, PUT 200, where `{ ok: true, cv }` is returned), `await track("funnel_cv_saved", { locale }, locals.observability)`.

### Success Criteria:

#### Automated Verification:

- Lint + type check pass: `npm run lint && npx astro check`
- Unit tests pass: `npm test`
- Each server call site emits the correct event name with `locals` identity (tests mock `track` and assert event name + identity argument)
- `cv_generated` is emitted only on the ok branch, never on the error branch
- The `email_confirmed` once-guard emits exactly once across repeated authenticated requests (not zero, not per-session)

#### Manual Verification:

- Completing signup, confirming, generating, and saving each produces exactly one corresponding event in PostHog
- `funnel_cv_generated` carries `model_provider`/`duration_ms`/`locale` and no content
- A second sign-in by the same user does NOT produce a second `funnel_email_confirmed`

**Implementation Note**: After this phase and all automated verification passes, pause for human confirmation of the manual checks before proceeding.

---

## Phase 3: Client-side funnel emits (4 events) + funnel verification

### Overview

Emit the 4 client-only funnel events via `trackClient` and verify both funnel segments resolve end-to-end with aligned distinct_ids.

### Changes Required:

#### 1. Landing viewed

**File**: `src/pages/index.astro` / `src/components/...ProductLanding`

**Intent**: Record a landing-page view (anonymous segment), the top of the funnel.

**Contract**: Emit `trackClient("funnel_landing_viewed", { locale })` when the landing renders in the browser (e.g. a small client island / `client:load` effect). Reuses the bootstrapped distinct_id from Phase 1, so it shares the anon-session id with `signup_completed`.

#### 2. Questionnaire started

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Record that the user began the questionnaire.

**Contract**: On component mount (the `idle`/step-0 initial render, `QuestionnaireFlow.tsx:33-44`), `trackClient("funnel_questionnaire_started", { locale })`. Fire once per mount (effect with empty deps).

#### 3. Questionnaire completed

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Record that the user finished answering and requested generation — distinct from server-side `cv_generated`.

**Contract**: In `handleGenerate` (`QuestionnaireFlow.tsx:52-84`), at the point the user submits all answers (just before/at the generate fetch), `trackClient("funnel_questionnaire_completed", { locale })`.

#### 4. PDF exported

**File**: `src/components/hooks/useCvExport.ts`

**Intent**: Record a successful PDF export — the funnel's terminal step. Pure client (no server round-trip).

**Contract**: On the success transition (`useCvExport.ts`, `setStatus("done")` after `triggerDownload`), `trackClient("funnel_pdf_exported", { locale })`.

### Success Criteria:

#### Automated Verification:

- Lint + type check pass: `npm run lint && npx astro check`
- Unit/component tests pass: `npm test`
- Each client emit point calls `trackClient` with the correct event name (tests mock `trackClient`); `questionnaire_started` fires once per mount; `pdf_exported` fires only on the done branch

#### Manual Verification:

- A full walk (landing → signup → confirm → questionnaire → generate → save → export) produces all 8 events in PostHog
- The **anonymous** funnel (`landing_viewed` → `signup_completed`) resolves with a single anon-session distinct_id
- The **identified** funnel (`email_confirmed` → `pdf_exported`, 6 steps spanning server + client) resolves with a single pseudonymous distinct_id — confirming client/server id alignment
- No event carries any raw answer/prompt/draft/CV content (spot-check payloads)

**Implementation Note**: This is the final coherence check — confirm all 8 steps are wired and both funnels read correctly before closing the slice.

---

## Testing Strategy

### Unit Tests:

- `resolveRequestIdentity`: authenticated → pseudonymous id; anonymous → anon-session id; never the raw user id.
- Extended event unions compile; `client.browser.test.ts` covers `bootstrap.distinctID` forwarding + `$process_person_profile:false`.
- Each server emit site (signup, generate ok-only, cv save) calls `track` with the right event name and `locals` identity (mock `track`).
- Email-confirm once-guard: emits exactly once across repeated requests.
- Each client emit site calls `trackClient` with the right name; questionnaire-started once per mount; pdf-export only on done.

### Integration / Manual Testing Steps:

1. Configure PostHog EU keys locally; walk the full 8-step flow.
2. In PostHog, build the anonymous funnel (`landing_viewed`→`signup_completed`) and the identified funnel (`email_confirmed`→…→`pdf_exported`); confirm step counts and single distinct_id per segment.
3. Sign in again as the same user — confirm no duplicate `funnel_email_confirmed`.
4. Trigger a generation failure — confirm no `funnel_cv_generated` is emitted (drop-off shows as absence).
5. Spot-check 2-3 event payloads for content-freeness.

## Performance Considerations

All emits are fire-and-forget over the existing time-boxed (`1_500ms`) `fetch` and must never block the user path — already guaranteed by `emit()` (`index.ts:40-58`). Identity HMAC is computed once per request in middleware, not per emit. Client emits reuse the single bootstrapped SDK instance.

## Migration Notes

No data migration. Rotating `OBSERVABILITY_ID_SALT` re-pseudonymizes identified-funnel ids (inherited F-01 caveat). The anon→identified boundary is intentionally unstitched; if a future slice wants a single connected funnel it must revisit the cookieless/no-person-profile posture (and the consent question, S-03).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01, lines ~100-111)
- F-01 contract: `context/changes/observability-baseline/plan.md` + `plan-brief.md`
- Recording contract: `src/lib/observability/index.ts`, `client.browser.ts`, `scrub.ts`, `identity.ts`
- Existing caller pattern: `src/pages/api/observability/smoke.ts:53-61`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation — event vocabulary + request identity

#### Automated

- [x] 1.1 Type checking passes (event unions + App.Locals): `astro sync && astro check`
- [x] 1.2 Lint passes: `npm run lint`
- [x] 1.3 Unit tests pass: `npm test`
- [x] 1.4 `resolveRequestIdentity` returns pseudonymous id when authed, anon-session id otherwise, never the raw user id
- [x] 1.5 `initClientObservability({ distinctId })` forwards `bootstrap.distinctID` and keeps `$process_person_profile:false`

#### Manual

- [ ] 1.6 Client SDK adopts the server distinct_id (not a fresh random id) with PostHog configured
- [ ] 1.7 Unconfigured PostHog: app runs normally, config banner still flags it (no regression)

### Phase 2: Server-side funnel emits (4 events)

#### Automated

- [ ] 2.1 Lint + type check pass: `npm run lint && astro check`
- [ ] 2.2 Unit tests pass: `npm test`
- [ ] 2.3 Each server call site emits the correct event name with `locals` identity (mocked `track`)
- [ ] 2.4 `cv_generated` emitted only on the ok branch, never on error
- [ ] 2.5 `email_confirmed` once-guard emits exactly once across repeated authenticated requests

#### Manual

- [ ] 2.6 Signup / confirm / generate / save each produce exactly one corresponding event in PostHog
- [ ] 2.7 `funnel_cv_generated` carries model_provider/duration_ms/locale and no content
- [ ] 2.8 A second sign-in does NOT produce a second `funnel_email_confirmed`

### Phase 3: Client-side funnel emits (4 events) + funnel verification

#### Automated

- [ ] 3.1 Lint + type check pass: `npm run lint && astro check`
- [ ] 3.2 Unit/component tests pass: `npm test`
- [ ] 3.3 Each client emit point calls `trackClient` with the correct event name; questionnaire-started once per mount; pdf-export only on done

#### Manual

- [ ] 3.4 Full walk produces all 8 events in PostHog
- [ ] 3.5 Anonymous funnel (`landing_viewed`→`signup_completed`) resolves with a single anon-session distinct_id
- [ ] 3.6 Identified funnel (`email_confirmed`→`pdf_exported`) resolves with a single pseudonymous distinct_id (client/server id alignment confirmed)
- [ ] 3.7 No event carries raw answer/prompt/draft/CV content (payload spot-check)
