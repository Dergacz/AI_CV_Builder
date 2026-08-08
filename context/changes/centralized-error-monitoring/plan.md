# Centralized Error Monitoring (S-07) Implementation Plan

## Overview

Roadmap slice **S-07**. Extend the F-01 recording contract (`src/lib/observability/`) so failures across all four named surfaces — frontend, backend/API, AI generation, PDF export — reach the PostHog EU monitor, with request bodies, prompts, answers, and draft/CV content structurally incapable of leaving the product.

The contract already exists and is proven; what does not exist is coverage. Today exactly one route reports, and only for two fail-open paths. This slice closes that gap without inventing a second mechanism.

## Current State Analysis

**What F-01 already delivered (do NOT rebuild):**

- `reportError(error, context, identity)` — `src/lib/observability/index.ts:87`. Emits `observability_error` carrying `error_type` + `error_location` only; message and stack never leave. Proven by `index.test.ts:80`.
- `scrub()` — `src/lib/observability/scrub.ts:37`. Allowlist, drop-by-default, 14 permitted keys, 120-char string cap. A key not in `allowedPropertyKeys` cannot be emitted.
- `reportErrorClient` / `installBrowserErrorHandlers` — `src/lib/observability/client.browser.ts:103,115`. Live via `Layout.astro:61`; covers `window.onerror` + `unhandledrejection`.
- `resolveRequestIdentity` — `src/lib/observability/identity.ts:69`. One `distinctId` per request, cached on `context.locals.observability` by `middleware.ts:22`.
- Detached-emit precedent — `middleware.ts:34` hands a promise to `locals.cfContext.waitUntil` when present, else lets it run detached. `middleware.test.ts:85` asserts the Astro 6 `cfContext` key and that the *removed* `runtime.ctx` getter is not read.

**The coverage gap, surface by surface:**

| Surface | State today | Gap |
| --- | --- | --- |
| Backend / API | `generate.ts:67,120` only, both quota fail-open paths | 9 of 10 routes silent. `cv/index.ts:42,82`, `cv/[id].ts:52,99,128`, `cv/feedback.ts:60` are bare `catch {}` → 500. No top-level handler, so an *unhandled* route or middleware throw is entirely invisible. |
| AI generation | none | `cv-generation.ts` swallows 7 distinct failure modes into 2 buckets across `catch {}` at :247, :269, :280 and 4 early returns. `generate.ts:106` returns `!result.ok` without reporting. A total OpenAI outage produces zero error signal — only the absence of `funnel_cv_generated`, which S-01 explicitly deferred here. |
| PDF export | none | `useCvExport.ts:72` catches, classifies via `classifyExportError`, sets copy, reports nothing. This is the terminal funnel step. |
| Frontend | partial | Global hooks live. Client fetch failures at `useCvSave.ts:65`, `SavedCvList.tsx:42`, `QuestionnaireFlow.tsx:67` are caught and swallowed into user copy. |

**Other findings:**

- Two ad-hoc `console.warn` breadcrumbs survive from before F-01: `signout.ts:12` and `supabase.ts:62`. F-01 explicitly left them out of scope; S-07 is where they belong.
- No throttle on emission anywhere. Server emits are bounded by request rate (and by S-06's quota guard); client emits are not — a render loop or retry storm could fire unbounded captures.
- `useCvDraftEditor.ts` has **no network calls** — it is pure editor state. The questioning round named it as a save/load site; it is not one. The three real client fetch sites are listed above.
- `generateCvDraft(answers, config)` is a deliberately pure, dependency-free service (`cv-generation.ts:211`). Its header comment states failures are surfaced via buckets, not logs.

## Desired End State

Every failure that is *our* defect — a thrown exception, a 5xx path, a provider outage, a render crash, an export failure, a client transport failure — produces exactly one `observability_error` in PostHog carrying a precise, typed `error_location` and nothing else identifying. User-input rejections (zod 400s, wrong password, expired session, oversize body) produce none. No error path blocks a user-facing response on a PostHog round-trip. Client-side repeats of the same failure inside a short window collapse to one capture.

Verify by: `npm test` (unit + route contract per surface), `npm run lint`, `npm run build`, plus manual confirmation that a forced failure on each surface appears in PostHog with no content.

### Key Discoveries:

- The privacy guarantee is **structural, not procedural** — `scrub.ts:40` drops any key not in the allowlist, so no call site can leak by mistake. New locations therefore need no new privacy review, only a check that no new allowlist key is added carelessly.
- `middleware.test.ts:85` proves `locals.cfContext.waitUntil` is the correct Astro 6 key. Fire-and-forget has a tested precedent here, not a guess.
- `generate.ts:54-56` documents a deliberate ordering: quota check after zod validation but before the provider-key check. Phase 3 must not disturb it.
- `cv-generation.ts` has 7 failure modes, not 3: network/abort (:247), non-OK response (:253), response-JSON parse (:269), model refusal (:265), empty content (:274), content-JSON parse (:280), schema mismatch (:296).

## What We're NOT Doing

- **No React error boundary.** Explicitly declined during questioning. Island render crashes stay uncovered by this slice.
- **No feedback-submit reporting** (`useCvFeedback.ts`). Explicitly declined — that path is fail-soft by design.
- **No new E2E specs.** Verification is unit + route-contract, matching how S-05/S-06 were verified. Both retros note that adding specs to this suite costs unbudgeted repair time.
- **No server-side throttling.** Per-isolate state on Workers makes the cap unpredictable and risks suppressing genuinely distinct failures across users.
- **No reporting of validation/auth rejections** — zod 400s, wrong password, 401 expired session, 413 oversize body, and the S-06 quota refusals (which already have `generation_limit_reached`).
- **No new allowlist keys, no new env vars, no schema/migration changes, no changes to `track()` or the funnel events.**
- **No alerting, dashboards, or PostHog-side configuration.** Out of scope for FR-009.

## Implementation Approach

Four phases: build the shared machinery once, then wire each surface through it.

Phase 1 adds three primitives and changes no coverage — a typed `ErrorLocation` union so a typo is a compile error rather than a silently split PostHog bucket; a detached-emit scheduler wrapping the proven `waitUntil` pattern so no error response pays the 1.5s timeout; and a client dedupe window. Phases 2–4 are then pure wiring, each independently verifiable.

The AI surface (Phase 3) takes an **injected reporter callback** rather than importing `reportError` directly. This satisfies "report from inside the service, distinguishing the modes" while keeping `cv-generation.ts` pure and its existing unit tests free of an `astro:env/server` mock. The route owns identity and passes a bound reporter down.

## Critical Implementation Details

**Middleware catch-all must re-throw unchanged.** Astro's own error handling (dev overlay, 500 response) depends on the exception propagating. The wrapper reports and re-throws the *original* value — not a wrapped or normalized one.

**Ordering inside `middleware.ts`.** The `try` must wrap only `next()`, and must sit after `context.locals.observability` is resolved (`middleware.ts:22`) — otherwise the catch has no identity to report with. Failures in identity resolution itself are therefore out of the catch-all's reach; that is acceptable (it would mean PostHog is unconfigured anyway).

**Detached emission and test determinism.** With emission detached, assertions can no longer `await` the route and observe the call. Route tests must either inject a synchronous scheduler or assert on the scheduler having been handed a promise. Pick one shape in Phase 1 and use it consistently — this is the main way Phases 2–4 could turn flaky.

**The client dedupe key must be content-free.** Key on `error_type` + `error_location` only. Including anything derived from a message would put content into a comparison the scrubber never sees.

---

## Phase 1: Contract primitives

### Overview

Add the typed location taxonomy, the detached-emit scheduler, and the client dedupe window. Migrate the two existing awaited reports in `generate.ts` onto the scheduler. No new surface coverage — this phase exists so Phases 2–4 are pure wiring.

### Changes Required:

#### 1. Error location taxonomy

**File**: `src/lib/observability/locations.ts` (new)

**Intent**: Define every `error_location` this slice emits as one typed union, so an unknown or misspelled location fails at compile time instead of quietly creating a second bucket in PostHog that nobody notices for months.

**Contract**: Exports a string-literal union type following the existing `<module path>:<operation>` convention already in production at `generate.ts:67` (`"api/cv/generate:checkGenerationQuota"`). Must include the two existing locations plus every location introduced in Phases 2–4. `ErrorContext.error_location` in `index.ts:26` narrows from `string` to this union; `ClientErrorContext` in `client.browser.ts:16` narrows likewise for the client-emitted subset.

Note: `installBrowserErrorHandlers` (`client.browser.ts:123`) synthesizes locations from `filename:lineno` at runtime — those are unbounded by nature and must remain assignable. Model this as a union member for the dynamic case rather than widening the whole type back to `string`.

#### 2. Detached-emit scheduler

**File**: `src/lib/observability/schedule.ts` (new)

**Intent**: Give every server call site one way to emit without blocking the response, reusing the `waitUntil`-else-detached pattern that `middleware.ts:34` already proves works on Astro 6 + Cloudflare.

**Contract**: A function taking the promise (or a thunk producing it) plus `App.Locals`, which hands it to `locals.cfContext.waitUntil` when available and otherwise lets it run detached with a `.catch()` guard so it can never surface as an unhandled rejection. Also export the report-and-schedule convenience the routes will actually call, so no call site has to remember to detach. `middleware.ts` should be refactored to use this helper for its existing `trackEmailConfirmedOnce` emit rather than keeping the inline copy.

#### 3. Client dedupe window

**File**: `src/lib/observability/client.browser.ts`

**Intent**: Prevent a render loop, a retry storm, or a repeatedly-firing listener from emitting unbounded captures. The unbounded risk is genuinely client-side; the server is bounded by request rate.

**Contract**: `reportErrorClient` (`client.browser.ts:103`) suppresses a capture whose `error_type` + `error_location` pair was already captured within a short window (~10s). The key is content-free by construction. The window must be resettable from tests, and `trackClient` (non-error events) is unaffected.

#### 4. Migrate the existing report sites

**File**: `src/pages/api/cv/generate.ts`

**Intent**: Move the two existing `await reportError(...)` calls (`:67`, `:120`) onto the scheduler so a quota-counter outage or a ledger-write failure no longer adds up to 1.5s to the user's response.

**Contract**: Same locations, same arguments, no longer awaited. Behavior of both fail-open paths is otherwise unchanged — a counter outage still generates, a failed ledger write still returns the draft.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- A test asserts the scheduler routes through `cfContext.waitUntil` when present and runs detached when absent
- A test asserts a repeated client report of the same type+location inside the window emits once, and that a distinct type or location is not suppressed
- Existing `generate.ts` route tests still pass against the non-awaited report sites

#### Manual Verification:

- App runs normally with PostHog unconfigured (emission remains a no-op)
- No unhandled-rejection warnings in the dev server console during a normal session

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Backend / API surface

### Overview

Close the 9-of-10 route gap. A middleware catch-all guarantees nothing escapes unreported regardless of future routes; explicit reports at the existing bare `catch {}` blocks give precise locations where routes handle their own failures and therefore never throw.

### Changes Required:

#### 1. Middleware catch-all

**File**: `src/middleware.ts`

**Intent**: Catch anything thrown out of a route or a downstream middleware, report it, and re-throw untouched so Astro's error handling is completely unchanged.

**Contract**: `next()` (`middleware.ts:50`) is wrapped in try/catch. The catch reports with the request path as part of the location and re-throws the original thrown value. Must sit after `context.locals.observability` is resolved (`:22`). Uses the Phase 1 scheduler.

#### 2. CV routes

**File**: `src/pages/api/cv/index.ts`, `src/pages/api/cv/[id].ts`, `src/pages/api/cv/feedback.ts`

**Intent**: The bare `catch {}` blocks that return 500 (`index.ts:42,82`; `[id].ts:52,99,128`; `feedback.ts:60`) currently discard the cause entirely. Report each with a distinct location before returning the unchanged user-facing bucket.

**Contract**: Each catch gains a scheduled `reportError` with its own `ErrorLocation` member (load / save / delete / feedback-store). Response status, body, and error bucket are **unchanged** — this phase adds observation only, never behavior. Owner-not-found and validation rejections stay unreported.

#### 3. Ad-hoc breadcrumbs

**File**: `src/pages/api/auth/signout.ts`, `src/lib/supabase.ts`

**Intent**: Replace the two pre-F-01 `console.warn` breadcrumbs (`signout.ts:12`, `supabase.ts:62`) with real reports — a swallowed sign-out failure and a stale-session clear failure are both our defects, and today they exist only in Worker logs.

**Contract**: `signout.ts` reports and keeps its existing response behavior. `supabase.ts:62` sits in `safeGetUser`, which runs before identity resolution and has no `locals` — report without identity (a no-op when unresolvable) or drop the console line in favor of letting the middleware catch-all see it, whichever the implementer finds does not force a dependency cycle. Do not change the fail-safe behavior of either.

#### 4. Auth routes

**File**: `src/pages/api/auth/*.ts`

**Intent**: Confirm — and leave — the deliberate non-coverage. Supabase auth rejections (wrong password, unconfirmed email, consent missing) are user-input outcomes under the "ours, not theirs" rule; a thrown transport failure to Supabase is caught by the middleware catch-all.

**Contract**: No code change. Recorded here so a future reader does not read the absence as an oversight.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- A middleware test asserts a thrown route error is reported **and** re-thrown unchanged
- Route-contract tests assert each 500 path reports exactly once with its expected location, and that validation/auth rejection paths report zero times
- A test asserts response status and body are byte-identical to pre-change behavior on at least one reporting path

#### Manual Verification:

- Forcing a CV save failure surfaces the existing user-facing message with no visible latency change
- The corresponding `observability_error` appears in PostHog with the expected location and no request-body content

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 3: AI generation surface

### Overview

The sharpest blind spot. Make `cv-generation.ts` distinguish its seven failure modes instead of collapsing them into two user-facing buckets, so "OpenAI is down" is operationally distinguishable from "the model returned unparseable output" and from "we timed out".

### Changes Required:

#### 1. Injected reporter

**File**: `src/lib/services/cv-generation.ts`

**Intent**: Report each failure mode from the point it is detected, while keeping the service pure and dependency-free — its existing unit tests must not need an `astro:env/server` mock.

**Contract**: `generateCvDraft(answers, config)` (`:211`) accepts an optional reporter on `config` — a callback taking the caught value (or `undefined` for the non-throwing modes) and an `ErrorLocation`. Every failure path calls it before returning its bucket:

| Site | Mode | Bucket returned (unchanged) |
| --- | --- | --- |
| `:247` catch | network / timeout / abort | `service_unavailable` |
| `:253` | non-OK provider response | `service_unavailable` |
| `:269` catch | response-JSON parse | `service_unavailable` |
| `:265` | model refusal | `generation_failed` |
| `:274` | empty content | `generation_failed` |
| `:280` catch | content-JSON parse | `generation_failed` |
| `:296` | schema mismatch | `generation_failed` |

Returned buckets, messages, and the missing-API-key early return (`:215`) are unchanged. The service must remain safe to call with no reporter supplied. Its file header comment (`:13`) — "failures are surfaced via error buckets, not logs" — needs updating to reflect that scrubbed, content-free reporting now also happens.

#### 2. Wire the route

**File**: `src/pages/api/cv/generate.ts`

**Intent**: Supply the reporter, bound to the request's identity and scheduled off the response path.

**Contract**: The `generateCvDraft` call (`:103`) passes a reporter that schedules `reportError` with `context.locals.observability`. The documented ordering at `:54-56` (validation → quota → provider-key check → generation) is untouched. No second report is emitted at `:106` — the service already reported the specific cause, and double-reporting would make rates meaningless.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- A test per failure mode asserts the reporter is called once with that mode's distinct location and that the returned bucket is unchanged
- A test asserts `generateCvDraft` works with no reporter supplied
- A test asserts a successful generation reports zero times
- A test asserts no answer or draft content appears in what the reporter receives

#### Manual Verification:

- With a deliberately invalid `OPENAI_API_KEY`, a generation attempt shows the existing `service_unavailable` copy and produces one PostHog error at the non-OK-response location
- Answer text and prompt content are absent from the captured event

**Implementation Note**: Pause for manual confirmation before proceeding.

---

## Phase 4: Client surfaces

### Overview

Cover the caught-and-swallowed client failures: PDF export (the terminal funnel step), and the CV mutation/transport fetches.

### Changes Required:

#### 1. PDF export

**File**: `src/components/hooks/useCvExport.ts`

**Intent**: The catch at `:72` already classifies the failure via `classifyExportError`; report it so a silent export failure at the last inch of the funnel is visible.

**Contract**: The catch calls `reportErrorClient` with a location distinguishing font/asset-fetch failure from render failure — reuse the existing `ExportErrorBucket` result rather than re-deriving it. User-facing copy, status transitions, and the `funnel_pdf_exported` emit on success (`:71`) are unchanged.

#### 2. CV mutation and transport fetches

**File**: `src/components/hooks/useCvSave.ts`, `src/components/cv/SavedCvList.tsx`, `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Report the client-side half of failures whose server half may never have happened. `QuestionnaireFlow.tsx:67` matters most: if the generate request never reaches the server, the AI surface is dark on *both* sides despite Phase 3.

**Contract**: Each site reports on transport failure (the `catch`) and on a non-OK response that maps to a server-fault bucket, with a distinct location per site. Do **not** report responses that carry a user-input or quota bucket — `daily_limit_reached` already has `generation_limit_reached`, and a 401 expired session is not a defect. `useCvDraftEditor.ts` is untouched: it has no network calls. `useCvFeedback.ts` is untouched by decision.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type checking passes: `npx astro sync && npx astro check`
- Linting passes: `npm run lint`
- Production build succeeds: `npm run build`
- A test asserts an export failure reports once with the classification-derived location, and that the user-facing copy is unchanged
- A test asserts a save/delete/generate transport failure reports once, and that a quota-refused or auth-rejected response reports zero times
- A test asserts the Phase 1 dedupe collapses a repeated identical client failure

#### Manual Verification:

- Forcing an export failure shows the existing error copy and produces exactly one PostHog error
- Going offline mid-save produces one error with no CV content in the payload
- A repeated failure in quick succession produces one capture, not many
- With `PUBLIC_POSTHOG_KEY` unset, every surface behaves normally and emits nothing

**Implementation Note**: Pause for manual confirmation. This is the final phase — after it, update the roadmap S-07 status to `done` with a Delivered summary, following the S-05/S-06 precedent.

---

## Testing Strategy

### Unit Tests:

- **Scheduler**: `waitUntil` used when present; detached fallback; a rejected emit never becomes an unhandled rejection.
- **Dedupe**: same type+location suppressed inside the window; distinct type or location not suppressed; window expiry re-allows.
- **Location union**: an unknown location does not type-check (compile-level, exercised by `astro check`).
- **Service failure modes**: one test per row of the Phase 3 table.
- **Privacy invariant per surface**: for each new report site, assert the emitted payload contains no answers, no draft content, no request body, no error message, no stack. This is the load-bearing check — the roadmap names third-party content leakage as S-07's main risk.

### Integration / Contract Tests:

- Route-contract tests per changed API route: reports exactly once on the 5xx path, zero times on validation/auth/quota paths, and response status + body unchanged from pre-change behavior.
- Middleware: thrown error reported and re-thrown unchanged; normal requests report zero times.

### Manual Testing Steps:

1. With PostHog configured, force a CV save failure — confirm one event, expected location, no content.
2. Set an invalid `OPENAI_API_KEY`, attempt generation — confirm existing copy plus one event at the provider-response location.
3. Force a PDF export failure — confirm one event and unchanged error copy.
4. Trigger the same client failure repeatedly — confirm dedupe collapses it.
5. Unset `POSTHOG_API_KEY` and `PUBLIC_POSTHOG_KEY` — confirm the app is fully functional and silent.
6. Confirm error responses show no added latency versus the pre-change build.

## Performance Considerations

The whole point of Phase 1's scheduler is that broadening coverage must not make failing requests slower. Before this change, one route awaited a report worth up to 1.5s (`OBSERVABILITY_TIMEOUT_MS`); after it, ~15 sites report and none block. On Workers the emit completes under `waitUntil`; in dev/node it runs detached, where a fast-exiting process may cut it short — acceptable, and the reason step 6 above compares latency rather than delivery.

Client bundle impact is negligible: no new dependency, and the dedupe is a small in-memory map.

## Migration Notes

None. No schema changes, no migrations, no new environment variables, no changes to existing event names or the scrub allowlist. Fully backward compatible — every user-facing response, status code, and error bucket is unchanged by design. Rollback is a straight revert; the F-01 contract underneath is untouched.

## References

- Roadmap slice S-07: `context/foundation/roadmap.md:183`
- F-01 contract and rationale: `context/changes/observability-baseline/plan-brief.md`
- Recording contract: `src/lib/observability/index.ts:87`, `scrub.ts:37`
- Detached-emit precedent: `src/middleware.ts:34`, asserted by `src/middleware.test.ts:85`
- Existing report sites: `src/pages/api/cv/generate.ts:67,120`
- Route-test mock pattern to follow: `src/pages/api/cv/generate.test.ts:43`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract primitives

#### Automated

- [x] 1.1 Unit tests pass: `npm test` — 12a0ee2
- [x] 1.2 Type checking passes: `npx astro sync && npx astro check` — 12a0ee2
- [x] 1.3 Linting passes: `npm run lint` — 12a0ee2
- [x] 1.4 Scheduler test: `waitUntil` when present, detached when absent — 12a0ee2
- [x] 1.5 Dedupe test: repeated identical client report emits once; distinct type/location not suppressed — 12a0ee2
- [x] 1.6 Existing `generate.ts` route tests pass against non-awaited report sites — 12a0ee2

#### Manual

- [x] 1.7 App runs normally with PostHog unconfigured (emission is a no-op) — 12a0ee2
- [x] 1.8 No unhandled-rejection warnings in the dev server console — 12a0ee2

### Phase 2: Backend / API surface

#### Automated

- [x] 2.1 Unit tests pass: `npm test` — 6ab0a13
- [x] 2.2 Type checking passes: `npx astro sync && npx astro check` — 6ab0a13
- [x] 2.3 Linting passes: `npm run lint` — 6ab0a13
- [x] 2.4 Middleware test: thrown route error reported and re-thrown unchanged — 6ab0a13
- [x] 2.5 Route-contract tests: each 500 path reports once with expected location; validation/auth paths report zero times — 6ab0a13
- [x] 2.6 Response status and body byte-identical to pre-change behavior on a reporting path — 6ab0a13

#### Manual

- [x] 2.7 Forced CV save failure shows existing message with no visible latency change — 6ab0a13
- [x] 2.8 Corresponding PostHog error has expected location and no request-body content — 6ab0a13

### Phase 3: AI generation surface

#### Automated

- [x] 3.1 Unit tests pass: `npm test` — 85cd240
- [x] 3.2 Type checking passes: `npx astro sync && npx astro check` — 85cd240
- [x] 3.3 Linting passes: `npm run lint` — 85cd240
- [x] 3.4 One test per failure mode: distinct location, unchanged bucket — 85cd240
- [x] 3.5 `generateCvDraft` works with no reporter supplied — 85cd240
- [x] 3.6 Successful generation reports zero times — 85cd240
- [x] 3.7 No answer or draft content reaches the reporter — 85cd240

#### Manual

- [x] 3.8 Invalid `OPENAI_API_KEY` shows existing copy and produces one event at the provider-response location — 85cd240
- [x] 3.9 Answer and prompt content absent from the captured event — 85cd240

### Phase 4: Client surfaces

#### Automated

- [x] 4.1 Unit tests pass: `npm test` — b8c85a6
- [x] 4.2 Type checking passes: `npx astro sync && npx astro check` — b8c85a6
- [x] 4.3 Linting passes: `npm run lint` — b8c85a6
- [x] 4.4 Production build succeeds: `npm run build` — b8c85a6
- [x] 4.5 Export failure reports once with classification-derived location; copy unchanged — b8c85a6
- [x] 4.6 Save/delete/generate transport failure reports once; quota-refused and auth-rejected report zero times — b8c85a6
- [x] 4.7 Dedupe collapses a repeated identical client failure — b8c85a6

#### Manual

- [x] 4.8 Forced export failure shows existing copy and produces exactly one PostHog error — b8c85a6
- [x] 4.9 Offline mid-save produces one error with no CV content — b8c85a6
- [x] 4.10 Repeated rapid failure produces one capture, not many — b8c85a6
- [x] 4.11 With `PUBLIC_POSTHOG_KEY` unset, every surface behaves normally and emits nothing — b8c85a6
- [x] 4.12 Roadmap S-07 status updated to `done` with a Delivered summary — b8c85a6
