<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Observability Baseline (F-01)

- **Plan**: context/changes/observability-baseline/plan.md
- **Scope**: Phases 1–4 of 4 (all complete)
- **Date**: 2026-06-11
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Privacy contract verified end-to-end: allowlist scrub cannot be bypassed (caller props can't overwrite the `$process_person_profile:false` guard via spread order); `reportError` forwards only `error.name` — never message/stack; client error hook is content-free (filename:lineno only); cookieless client (`persistence:"memory"`, `autocapture:false`); Workers-safe (Web Crypto, no `node:*`); client bundle proven not to import `astro:env/server`. No raw user id or content can reach `fetch`. The two existing `console.warn` calls are untouched; no funnel events emitted; scope guardrails respected. All automated criteria green (typecheck/lint/test 93 passed/build); manual PostHog verification confirmed by user.

## Findings

### F1 — config-status "PostHog configured" masks partial config

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (operability)
- **Location**: src/lib/config-status.ts (`configured: Boolean(POSTHOG_API_KEY)`)
- **Detail**: The banner's `configured` keys only on `POSTHOG_API_KEY`. With the server key set but `OBSERVABILITY_ID_SALT` unset, all authenticated identity silently degrades to anon sessions (identity.ts:30-33 → smoke.ts:49); with `PUBLIC_POSTHOG_KEY` unset the browser SDK is a silent no-op (client.browser.ts:64-66) — yet the banner reads "OK". This faithfully matches the Phase-1 plan contract, so it is a plan-level design gap, not implementation drift. Real but low-severity footgun.
- **Fix**: Broaden the PostHog config-status check (or add a second entry) to also reflect `OBSERVABILITY_ID_SALT` and `PUBLIC_POSTHOG_KEY`, so partial configuration surfaces in the banner instead of reading green. Keep the existing server/client env split in mind (`PUBLIC_*` is client-readable; the salt is server-side).
  - Strength: Closes a silent-degradation operability gap; small localized change in an existing pattern.
  - Tradeoff: Slightly more complex `configured` predicate; a salt-unset warning may be noisy in pure-local dev where identity doesn't matter.
  - Confidence: HIGH — config-status pattern is established and the degradation paths are confirmed in code.
  - Blind spot: Whether the team wants the salt treated as required (it's optional by plan design).
- **Decision**: FIXED — broadened `configured` to require POSTHOG_API_KEY && OBSERVABILITY_ID_SALT && PUBLIC_POSTHOG_KEY; reworded banner message; updated config-status.test.ts to cover partial config.

### F2 — Smoke route awaits two emits sequentially

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/pages/api/observability/smoke.ts:51-52
- **Detail**: `await track(...)` then `await reportError(...)` run sequentially; each can block up to `OBSERVABILITY_TIMEOUT_MS` (1.5s), so worst case ~3s before the 200. Within the plan's best-effort-awaited contract, and it's a dev-only guarded route, so production is unaffected.
- **Fix**: `await Promise.all([track(...), reportError(...)])` to cap added latency at ~1.5s. Optional — dev-only.
- **Decision**: FIXED — both emits now run concurrently via Promise.all.

### F3 — tokensMatch leaks token length via timing

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (security)
- **Location**: src/pages/api/observability/smoke.ts:23-32
- **Detail**: `tokensMatch` early-returns on length mismatch, leaking the secret's length via timing. The route is fail-closed and disabled in production (secret unset), and the secret is dev-only, so risk is low — the code comment already hedges "constant-time-ish".
- **Fix**: Accept as-is (documented), or hash both sides to a fixed width before comparing for a true constant-time compare.
- **Decision**: FIXED — `tokensMatch` now SHA-256-hashes both tokens to fixed-width digests and compares without early exit (true constant-time; no length leak).
