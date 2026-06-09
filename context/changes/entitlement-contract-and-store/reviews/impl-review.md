<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Entitlement Contract and Store (F-01)

- **Plan**: `context/changes/entitlement-contract-and-store/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-06-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Status and period-end invariant is intentionally delegated to writers

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260609132956_create_subscriptions.sql:46`
- **Detail**: `get_entitlement()` treats `current_period_end > now()` as the sole authority for Advanced status and ignores `status`. This matches the plan, including the cancellation rule that a canceled subscription remains Advanced until the paid period ends. The tradeoff is that a contradictory row such as `status = 'expired'` with a future `current_period_end` would still resolve as Advanced.
- **Fix**: Keep F-01 as implemented, and make S-02's webhook mapping/tests preserve the invariant that `expired` rows do not carry a future `current_period_end`.
  - Strength: Preserves the planned single-clock resolver and keeps status as payment lifecycle metadata rather than a second entitlement authority.
  - Tradeoff: The future writer path carries responsibility for avoiding contradictory rows.
  - Confidence: HIGH — the migration, resolver, and tests all encode the same contract, and the plan explicitly says active right now is defined by `current_period_end > now()`.
  - Blind spot: S-02 has not been implemented yet, so the future webhook mapping has not been reviewed.
- **Decision**: ACCEPTED — Keep F-01 as implemented. S-02 must preserve the invariant that `expired` rows do not carry a future `current_period_end`.

## Evidence

### Scope and drift

- Reviewed changed files from commits `82a6bbc`, `67721cc`, `5438a50`, and `d0e8af3` against the completed phases in the plan.
- Changed files were limited to the change folder, regenerated database types, new entitlement service/test/types, and the additive subscription migration.
- No unplanned `GET /api/entitlement`, route wiring, UI wiring, or service-role client factory was found.
- The migration matches the planned read-own-only RLS contract and has no authenticated insert/update/delete policies.
- The resolver and tests match the planned Basic/Advanced mapping, DB-error propagation, and no-row Basic default.

### Verification

- `npm run db:reset` passed after rerunning outside the sandbox because the Supabase CLI needed to write `~/.supabase/telemetry.json`.
- `npm run db:types` passed after rerunning outside the sandbox for the same Supabase CLI telemetry write.
- `npx astro check` passed after rerunning outside the sandbox because the Cloudflare Vite plugin needed to bind a local inspector port. Result: 0 errors, 0 warnings, 4 existing hints in `eslint.config.js`.
- `npm run lint` passed.
- `npm test -- src/lib/services/entitlements.test.ts` passed: 1 file, 5 tests.
- `npm test` passed: 12 files, 71 tests.
