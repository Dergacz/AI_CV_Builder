<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Saved CV Library (S-06)

- **Plan**: `context/changes/saved-cv-library/plan.md`
- **Scope**: Phases 1-6 of 6 completed implementation phases; Testing & Gates reviewed as current pending gate
- **Date**: 2026-06-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 7 warnings, 0 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | FAIL    |

## Verification

- `npx astro sync` — PASS
- `npm run lint` — FAIL: Prettier errors in `src/lib/cv-save.test.ts` and `src/lib/services/cv-repository.ts`; unnecessary type assertion in `src/lib/cv-save.test.ts`
- `npm run build` — PASS
- `npm run test` — PASS: 3 test files, 27 tests
- `npx supabase db reset` — NOT RUN during review because it resets local database state and requires explicit approval
- Manual E2E/RLS gates T.3/T.4 remain unchecked in the plan

## Findings

### F1 — Lint gate fails on current saved-CV edits

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/lib/cv-save.test.ts:59`, `src/lib/cv-save.test.ts:102`, `src/lib/services/cv-repository.ts:70`
- **Detail**: `npm run lint` fails on the current saved-CV implementation. Two failures are Prettier formatting, and one is an unnecessary `as GeneratedCvDraft` assertion. This blocks the plan's required lint/build/test gate.
- **Fix**: Apply Prettier formatting, remove the unnecessary assertion, and rerun `npm run lint`.
- **Decision**: FIXED — formatting corrected, unnecessary type assertion removed, and `npm run lint` passed.

### F2 — Save status can stay "Saved" after section edits

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/components/cv/CvEditor.tsx:105`, `src/components/hooks/useCvDraftEditor.ts:47`
- **Detail**: The save hook resets status to `idle` when the title changes, but section edits only update the draft editor state. After a successful save, the user can edit a section and still see `Saved`, which can make unsaved content look persisted.
- **Fix**: Add a narrow dirty-state bridge between `useCvDraftEditor` and `useCvSave`, so committed section edits clear the saved status.
  - Strength: Keeps the existing hook split while making the user-visible persistence state accurate.
  - Tradeoff: Adds a small cross-hook contract for dirty state.
  - Confidence: HIGH — the stale state follows directly from independent `status` and draft editor state.
  - Blind spot: Browser interaction was not re-run after the review.
- **Decision**: FIXED — `useCvSave` now exposes `markUnsaved()`, and committed section edits clear a stale saved confirmation.

### F3 — Dashboard load failures render as an empty library

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/dashboard.astro:19`
- **Detail**: `listCvs` failures are caught and converted to `cvs = []`. A Supabase outage, missing migration, or RLS/query regression would render "0 saved" or the empty state, making existing saved data look deleted.
- **Fix**: Track a server-side `loadError` flag and render an alert/retry state instead of the empty library when `listCvs` throws.
  - Strength: Separates "no saved CVs" from "could not load CVs" without changing the repository contract.
  - Tradeoff: Adds one more dashboard state and copy string.
  - Confidence: HIGH — the catch block currently discards the error path.
  - Blind spot: No dedicated dashboard failure test exists.
- **Decision**: FIXED — dashboard now renders a load-error alert instead of the empty state when saved CV listing fails.

### F4 — Delete confirmation can submit concurrent deletes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/cv/SavedCvList.tsx:35`, `src/components/cv/ConfirmDialog.tsx:105`
- **Detail**: While `deleting` is true, the confirm button remains enabled. Repeated clicks can issue concurrent DELETE requests for the same CV; a later 404 can surface failure feedback after the first request actually deleted the row.
- **Fix**: Add a disabled/loading prop to `ConfirmDialog`'s confirm button and return early from `confirmDelete()` when `deleting` is already true.
- **Decision**: FIXED — `ConfirmDialog` supports a disabled confirm action, and `SavedCvList` now blocks duplicate delete submissions while a delete is in flight.

### F5 — Body-size guard trusts Content-Length only

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/cv/index.ts:53`, `src/pages/api/cv/[id].ts:67`
- **Detail**: The saved-CV routes enforce `MAX_REQUEST_BODY_BYTES` only through the `Content-Length` header. If the header is absent or inaccurate, the handler still parses the full JSON body. The generate route has the same pattern, but saved-CV payloads include larger draft content and are persisted.
- **Fix**: Centralize bounded JSON parsing for these API routes: read an `ArrayBuffer`, check `byteLength`, then `JSON.parse`.
  - Strength: Enforces the size limit regardless of client headers and avoids duplicating parsing code.
  - Tradeoff: Touches all saved-CV body parsing paths and should be checked against Astro/Cloudflare request semantics.
  - Confidence: MEDIUM — the risk is real, but current payload cap is small and route count is limited.
  - Blind spot: Cloudflare runtime behavior for very large request bodies was not tested.
- **Decision**: FIXED — saved-CV write routes now use bounded JSON parsing that checks actual body byte length before schema validation; regression test covers missing `Content-Length`.

### F6 — Unplanned workflow changes alter CI/deploy surface

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `.github/workflows/ci.yml:3`, `.github/workflows/deploy.yml:1`
- **Detail**: The saved-CV plan did not include workflow changes. The current worktree removes CI on `push` to `master`, contradicting repository guidance that CI runs on pushes and PRs to `master`, and adds a new Cloudflare deploy workflow that changes release behavior.
- **Fix A ⭐ Recommended**: Move workflow changes into a separate change or explicitly amend the saved-CV plan before keeping them.
  - Strength: Preserves scope discipline and makes deployment behavior reviewable on its own terms.
  - Tradeoff: Requires either reverting/moving current workflow edits or documenting a plan addendum.
  - Confidence: HIGH — the workflow files are outside the S-06 planned file list and affect repo-wide behavior.
  - Blind spot: The deploy workflow may come from a separate user-intended task not reflected in this plan.
- **Fix B**: Keep the workflow changes in S-06 and document them as an implementation addendum.
  - Strength: Avoids splitting already-present work.
  - Tradeoff: Couples product persistence work to release pipeline changes.
  - Confidence: MEDIUM — acceptable only if the team deliberately wants deployment scope in this slice.
  - Blind spot: No Linear/roadmap evidence was checked for a deployment task.
- **Decision**: FIXED via Fix A — workflow edits are now owned by separate change `context/changes/deployment-workflow/change.md`; saved-CV scope no longer claims CI/deploy behavior.

### F7 — New tests are not wired into CI/deploy

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `package.json:13`, `.github/workflows/ci.yml:16`, `.github/workflows/deploy.yml:21`
- **Detail**: The implementation adds `npm run test` and the plan's final gate requires tests, but CI/deploy run only sync, lint, and build. Saved-CV schema/repository tests can regress without blocking PRs or deployment.
- **Fix**: Add `npm run test` after lint in CI and deploy, or document tests as local-only and remove them from the required gate.
- **Decision**: FIXED — CI and deploy workflows now run `npm run test` after lint and before build; local `npm run test` passed.
