<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: PDF Export (S-07)

- **Plan**: `context/changes/pdf-export/plan.md`
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-06-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | WARNING |
| Safety & Quality    | WARNING |
| Architecture        | WARNING |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

## Verification

- `npx astro sync` — PASS
- `npm run lint` — PASS; emitted known `astro-eslint-parser` projectService warnings
- `npm run test` — PASS; 6 test files, 37 tests
- `npm run build` — PASS; emitted non-fatal CSS/chunk/sitemap warnings
- Server bundle inspection — PASS; `@react-pdf/renderer` appears in client chunks, while server chunks contain no react-pdf code outside Astro's manifest listing client assets
- Scoped formatting check for PDF-export files — PASS via `npx prettier --check ...`
- Repo-wide formatting check — NOT CLEAN due to unrelated dirty `context/foundation/roadmap.md`

## Findings

### F1 — Unbreakable PDF sections can overflow long content

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/cv/CvPdfDocument.tsx:68`
- **Detail**: `Section` sets `wrap={false}`, and experience/education items also do this. Long user text can become an unbreakable A4 block, risking clipped content or bad pagination.
- **Fix**: Remove `wrap={false}` from section and long item containers; keep only small headings/metadata together if needed, then manually test long summary/experience content.
- **Decision**: PENDING

### F2 — Unplanned `client:only` hydration change

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture / Scope Discipline
- **Location**: `src/pages/cv/new.astro:22`, `src/pages/cv/[id].astro:52`
- **Detail**: Both CV islands changed from `client:load` to `client:only="react"`. The plan said no route prop/threading changes, and the export code already dynamically imports `@react-pdf/renderer` only on click. Build evidence shows react-pdf is client-chunked, not server application code.
- **Fix A ⭐ Recommended**: Revert these islands to `client:load`
  - Strength: Restores the existing SSR/hydration pattern and keeps the change focused on export.
  - Tradeoff: Requires rerunning build/export smoke checks.
  - Confidence: MED — current build output suggests `client:only` is unnecessary, but I did not test the reverted version.
  - Blind spot: There may have been an unrecorded runtime issue that motivated the change.
- **Fix B**: Keep `client:only` and document the runtime reason in the plan
  - Strength: Preserves current implementation if it solved a real browser/runtime issue.
  - Tradeoff: Broadens rendering behavior for the whole questionnaire/reopen experience.
  - Confidence: MED — acceptable only with concrete runtime evidence.
  - Blind spot: No such evidence is currently in the plan.
- **Decision**: PENDING

### F3 — Exporting progress lacks `role="status"`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/components/cv/CvEditor.tsx:119`
- **Detail**: The plan required a `role="status"` exporting progress region. The button changes to "Preparing PDF..." with `aria-busy`, and completion has `role="status"`, but the exporting state itself has no live status region.
- **Fix**: Add a `role="status" aria-live="polite"` exporting message near the save bar while `exporter.status === "exporting"`.
- **Decision**: PENDING

### F4 — Creation-flow copy still frames PDF export as future work

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/pages/cv/new.astro:16`, `src/components/cv/QuestionnaireFlow.tsx:317`
- **Detail**: Copy still says "Saving and PDF export come in later steps." After S-07, export is available after draft generation, so this can read stale.
- **Fix**: Reword to "After generation, you can save and export your reviewed CV."
- **Decision**: PENDING
