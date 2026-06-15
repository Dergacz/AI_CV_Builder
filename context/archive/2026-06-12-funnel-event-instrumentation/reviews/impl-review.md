<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Funnel-Event Instrumentation (S-01)

- **Plan**: context/changes/funnel-event-instrumentation/plan.md
- **Scope**: All 3 phases
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION → resolved (F1 + F2 fixed, F3 accepted)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1, fixed) |
| Architecture | PASS |
| Pattern Consistency | WARNING (F2, fixed) |
| Success Criteria | PASS |

Plan-drift sub-agent: all 18 planned changes verified MATCH, no scope creep, both design invariants intact (single distinct_id resolved once + bootstrapped to client; `$process_person_profile:false` preserved). Safety sub-agent: no CRITICAL — scrubber allowlist, anon/pseudonymous id discipline, and fire-and-forget emits all correct; no raw content or raw user id reaches any emit.

## Findings

### F1 — email_confirmed emit awaited on the request hot path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/middleware.ts:26-31 (also funnel.ts:47)
- **Detail**: Middleware runs on every request and `await`ed trackEmailConfirmedOnce. On the first authenticated request after confirmation, that awaits a real PostHog fetch (1.5s timeout), so a real user request could block up to 1.5s. The marker cookie is set synchronously before the fetch, so fire-and-forget does not weaken the once-guard.
- **Fix A ⭐ Recommended**: Fire-and-forget via Cloudflare waitUntil with detached-run fallback for dev/node.
  - Strength: Removes the up-to-1.5s block from a real user request; guard still correct.
  - Tradeoff: Needs runtime.ctx access via a narrow cast (runtime not typed in repo).
  - Confidence: MED — adapter exposes runtime.ctx; guarded with optional chaining.
  - Blind spot: runtime.ctx population in `astro dev` (falls back to detached run).
- **Decision**: FIXED via Fix A (commit pending)

### F2 — Code comments overstate "PostHog dedupes by distinct_id"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (comment accuracy)
- **Location**: funnel.ts:5,26 · cv/index.ts:78 · cv/[id].ts:95
- **Detail**: With `$process_person_profile:false`, PostHog does not dedupe raw captures. Funnel queries take first-touch per distinct_id (conversion unaffected by repeats), but raw counts inflate, and for email_confirmed the cookie is the sole guard. The wording risked misleading a future maintainer into weakening the cookie guard.
- **Fix**: Reworded comments to state the cookie is authoritative and that funnel queries first-touch per distinct_id (raw counts may inflate).
- **Decision**: FIXED

### F3 — questionnaire_started effect uses [locale] deps, not "once per mount"

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/cv/QuestionnaireFlow.tsx:48-50
- **Detail**: Plan said "once per mount (empty deps)"; code uses [locale] deps and no client-side once-guard, so it can re-fire on remount/locale change. Funnel uses first-touch so conversion is unaffected; raw counts can inflate. Consistent with the "emit every occurrence" decision.
- **Fix**: Accept + document, or gate with a module-level once flag.
- **Decision**: SKIPPED (consistent with the every-occurrence decision; funnel conversion unaffected)
