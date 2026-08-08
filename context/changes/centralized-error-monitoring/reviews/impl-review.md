<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Centralized Error Monitoring (S-07)

- **Plan**: `context/changes/centralized-error-monitoring/plan.md`
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-08-08
- **Verdict**: NEEDS ATTENTION → **RESOLVED** (F1–F3 fixed, F4 skipped by decision)
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Verification performed

Independently re-ran all four automated criteria: `npm test` 283/283, `npx astro check` 0 errors / 0 warnings, `npm run lint` clean, `npm run build` succeeds.

Diff scoped to the four S-07 commits (`12a0ee2^..HEAD`) — note that `master...HEAD` is misleading here because the local `master` ref is stale and sweeps in every prior slice.

Audited: 22 report call sites; zero declared-but-unused locations; zero used-but-undeclared locations; both pre-F-01 `console.warn` calls removed. All nine "What We're NOT Doing" guardrails confirmed untouched by the S-07 diff — including `scrub.ts` (no new allowlist keys), `events.ts` (no funnel changes), `useCvFeedback.ts`, `useCvDraftEditor.ts`, `astro.config.mjs` (no new env vars), `package.json`/`package-lock.json` (no new deps), and `e2e/` (no new specs).

## Findings

### F1 — SSR page loads bypass the API and report nothing

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `src/pages/dashboard.astro:26`, `src/pages/cv/[id].astro:27`
- **Detail**: A gap in the *plan*, not a deviation from it. The plan's Current State Analysis surveyed `src/pages/api/**` and concluded "9 of 10 routes silent", never noticing that two `.astro` pages call the repository directly, bypassing the API: `dashboard.astro:26` (`listCvs` → `catch {}` → `loadError = true`) and `cv/[id].astro:27` (`getCv` → `catch {}` → silent redirect). Both are the same failure class as `api/cv/index:load` and `api/cv/[id]:load`, which p2 instrumented — but these are the paths users actually hit, since the library and reopen view are server-rendered; the GET API routes may be cold in production. The middleware catch-all does not cover them (both catch internally). `cv/[id].astro` is worse: the user is bounced to `/dashboard` with no error message, so they cannot report it either. Relatedly these are the two `safeGetUser` call sites where `locals` was not threaded (both have `Astro.locals` available), so `lib/supabase:safeGetUser` is dead there too. Same root cause: `.astro` pages were never surveyed.
- **Fix A ⭐ Recommended**: Add the two report sites now — 2 new locations, 2 call sites, plus threading `Astro.locals` into the 2 `safeGetUser` calls.
  - Strength: Closes the hole in the surface the slice claims to cover; purely additive; matches the six shipped p2 sites exactly.
  - Tradeoff: Extends the diff after plan close-out; needs a roadmap Delivered-line amendment.
  - Confidence: HIGH — identical to the p2 pattern already shipped.
  - Blind spot: `.astro` files are outside the related-tests hook and have no unit-test harness here, so these two sites would be manual-verify only.
- **Fix B**: Record as a follow-up, ship S-07 as-is.
  - Strength: Keeps the closed plan closed; gap documented rather than silently carried.
  - Tradeoff: The roadmap currently claims all four surfaces are covered — overstated until the follow-up lands.
  - Confidence: HIGH — gap is well understood and bounded.
  - Blind spot: Follow-ups on this project wait (S-04/S-05/S-06/S-09 all still pending archival).
- **Decision**: FIXED via Fix A — added `pages/dashboard:listCvs` + `pages/cv/[id]:getCv` report sites, threaded `Astro.locals` into both `safeGetUser` calls, and added a `z.uuid()` guard to `cv/[id].astro` so a malformed id (user input) redirects silently while a real DB failure reports.

### F2 — Generate success path can leave status stuck on "loading"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/cv/QuestionnaireFlow.tsx:60-96`
- **Detail**: Introduced by the p4 extraction. Before, the whole body sat inside one try/catch whose handler set `status="error"`. Now `postCvGenerate` owns fetch+parse and the branch handling (`setDraft`, `setGenerationEventId`, `defaultCvTitle(...)`) sits outside any try/catch. If anything there throws, `status` stays `"loading"` forever — spinner, no error, no retry. Probability is low (`defaultCvTitle` is pure string work on validated answers; the rest is setState) but it is a net reduction in defensive behavior on the core flow F-02's regression net exists to protect.
- **Fix**: Wrap the post-response branch in try/catch that sets `status="error"` + `service_unavailable` copy and reports it, restoring the pre-refactor guarantee that the flow always leaves "loading".
- **Decision**: FIXED — post-response branch in `handleGenerate` wrapped in try/catch that sets `status="error"` + `service_unavailable` copy and reports `components/QuestionnaireFlow:postResponse`. The flow can no longer be stranded in "loading".

### F3 — Tests for three modules live in one misnamed file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/components/hooks/useCvSave.test.ts:21-23`
- **Detail**: CLAUDE.md states "Test files live next to sources as `src/**/*.test.ts`", and every other test file tests its neighbour. This one imports `postCvSave` (correct), `deleteCvRequest` from `cv/SavedCvList.tsx`, and `postCvGenerate` from `cv/QuestionnaireFlow.tsx`. Those two modules now export tested functions but have no test file bearing their name, so a developer editing either won't find the coverage.
- **Fix**: Split into `SavedCvList.test.ts` and `QuestionnaireFlow.test.ts` beside their sources, keeping the shared fetch stubs.
- **Decision**: FIXED — split into three colocated specs: `useCvSave.test.ts`, `cv/SavedCvList.test.ts`, `cv/QuestionnaireFlow.test.ts`. Suite is now 42 files / 285 tests.

### F4 — exportErrorLocation duplicates location literals

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/lib/cv-export-error.ts:39-41`
- **Detail**: The return type hardcodes the two location strings rather than deriving from `ClientErrorLocation`, so the literals live in two files — mildly against the single-source-of-truth the union was built for. Largely self-correcting: a rename in `locations.ts` breaks assignability at the `reportErrorClient` call site, so it cannot drift silently.
- **Fix**: Narrow the return type to ``Extract<ClientErrorLocation, `hooks/useCvExport:${string}`>``.
- **Decision**: SKIPPED — self-correcting via assignability at the `reportErrorClient` call site; not worth importing the locations union into a deliberately zod-free, client-safe module.

## Post-triage verification

Re-ran after applying F1–F3: `npm test` 285/285 across 42 files, `npx astro check` 0 errors / 0 warnings, `npm run lint` clean, `npm run build` succeeds. Location audit re-run: zero declared-but-unused, zero used-but-undeclared.

Coverage after triage: 24 report sites (22 at review time + 2 SSR page loads). All four FR-009 surfaces plus the SSR page loads the plan had missed.
