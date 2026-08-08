# Centralized Error Monitoring (S-07) — Plan Brief

> Full plan: `context/changes/centralized-error-monitoring/plan.md`

## What & Why

Roadmap slice **S-07** (FR-009). Failures across all four surfaces — frontend, backend/API, AI generation, PDF export — must reach the PostHog EU monitor, scrubbed of request bodies, prompts, answers, and draft/CV content. F-01 built the recording contract; this slice builds the coverage. The gap it closes is sharp: a total OpenAI outage today produces **zero** error signal, visible only as the absence of a funnel event.

## Starting Point

`reportError` exists and is proven (`src/lib/observability/index.ts:87`), routing through a drop-by-default allowlist scrubber — only `error_type` and `error_location` ever leave. But exactly one route calls it, and only for two quota fail-open paths. Nine of ten API routes swallow failures into bare `catch {}` → 500. `cv-generation.ts` collapses seven distinct failure modes into two user-facing buckets and reports none. `useCvExport.ts:72` catches, classifies, and reports nothing. Two pre-F-01 `console.warn` breadcrumbs still exist. Browser `error`/`unhandledrejection` hooks are live and are the one thing already working.

## Desired End State

Every failure that is *our* defect produces exactly one `observability_error` with a precise typed location and nothing identifying. User-input rejections produce none. No error path blocks the user's response on a PostHog round-trip. Repeated client failures inside a short window collapse to one capture.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| What counts as reportable | Ours, not theirs | 5xx / throws / provider outages / crashes report; zod 400s, wrong password, 401, 413, quota refusals do not — so every entry is something to fix | Plan |
| API coverage mechanism | Middleware catch-all **+** explicit call sites | The catch-all makes coverage rot-proof for future routes; explicit calls reach routes that handle failures internally and never throw (most of the current gap) | Plan |
| AI failure reporting | Inside the service, per mode | "OpenAI is down" vs "unparseable output" vs "timeout" is the diagnosis you need at 3am; the collapsed bucket can't tell them apart | Plan |
| Service purity | Injected reporter callback | Satisfies per-mode reporting without giving the pure service an `astro:env/server` dependency or forcing a mock into its existing tests | Plan |
| Emit scheduling | Fire-and-forget via `cfContext.waitUntil`, detached fallback | Broadening to ~15 sites must not add 1.5s to every error response; the pattern is already proven and tested at `middleware.ts:34` | Plan |
| Location taxonomy | Typed union, `module:operation` | Extends the convention already in production; a typo becomes a compile error rather than a silently split PostHog bucket | Plan |
| Throttling | Client-side dedupe only | Unbounded risk is client-side (loops, retries); server is bounded by request rate, and per-isolate Worker state would make a server cap unpredictable | Plan |
| Verification | Unit + route-contract, no new E2E | Matches how S-05/S-06 were verified; error paths are easy to force with mocks, and both retros note this suite costs unbudgeted repair time | Plan |

## Scope

**In scope:** typed location union; detached-emit scheduler; client dedupe; middleware catch-all; explicit reports in the CV routes and the two `console.warn` breadcrumbs; per-mode reporting in `cv-generation.ts`; PDF export, save/delete, and generate-transport client reporting.

**Out of scope:** React error boundary (declined); feedback-submit reporting (declined, fail-soft by design); new E2E specs; server-side throttling; reporting validation/auth/quota rejections; new allowlist keys, env vars, or migrations; alerting and dashboards.

## Architecture / Approach

Build the machinery once, then wire each surface through it. Phase 1 adds three primitives and changes no coverage. Phases 2–4 are pure wiring, each independently verifiable. Privacy stays **structural rather than procedural** — `scrub.ts:40` drops any key not on the allowlist, so no new call site can leak by mistake; the plan adds no new allowlist keys. Every user-facing response, status code, and error bucket is unchanged by design: this slice adds observation only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contract primitives | Typed locations, detached scheduler, client dedupe; migrate the 2 existing sites | Detached emission makes route-test assertions non-deterministic — pick one test shape here and hold it |
| 2. Backend / API surface | Middleware catch-all + explicit reports across CV routes and breadcrumbs | Catch-all must re-throw the *original* value or Astro's error handling changes |
| 3. AI generation surface | Seven failure modes reported distinctly via injected reporter | Disturbing the documented validation → quota → provider-key ordering at `generate.ts:54-56` |
| 4. Client surfaces | Export, save/delete, and generate-transport reporting | Over-reporting normal conditions (offline users, quota refusals) turns the stream into noise |

**Prerequisites:** F-01 (done). PostHog EU configured for manual verification; nothing blocks the automated work.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- **Two questioning answers didn't survive contact with the code.** `useCvDraftEditor` was named as a save/load site but has no network calls at all; the real fetch sites are `useCvSave.ts:65`, `SavedCvList.tsx:42`, and `QuestionnaireFlow.tsx:67`. The plan covers those three. Including the QuestionnaireFlow one is a deliberate widening beyond the literal answer — without it, a generate request that never reaches the server leaves the AI surface dark on both sides despite Phase 3. Say so if you'd rather it were dropped.
- Detached emits in dev/node may be cut short by process exit — acceptable, and the reason manual verification compares latency rather than delivery.
- The "ours, not theirs" rule means a validation schema that is wrong for real users reads as silence, not a spike. Revisit if 400s become a support theme.
- React island render crashes remain uncovered by decision — `window.onerror` does not catch them, so a crashed island still blanks silently.

## Success Criteria (Summary)

- A forced failure on each of the four surfaces produces exactly one PostHog error with a precise location and no answers, draft content, request body, message, or stack.
- Every user-facing response, status code, and error bucket is provably unchanged, with no added latency on error paths.
- With PostHog unconfigured, all four surfaces behave normally and emit nothing.
