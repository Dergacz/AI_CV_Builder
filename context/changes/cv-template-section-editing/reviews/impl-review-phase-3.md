<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: CV Template and Section Editing

- **Plan**: context/changes/cv-template-section-editing/plan.md
- **Scope**: Phase 3 of 3
- **Date**: 2026-06-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 3 warnings 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | FAIL    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | FAIL    |

## Findings

### F1 — Regenerate guard leaks editor state

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/cv/CvEditor.tsx:45
- **Detail**: Phase 3 says the prompt appears only when edits exist and confirm clears edit state. Current code prompts when `editor.openSection !== null`, even if nothing was saved, and confirm calls `onEditAnswers()` without resetting `hasEdits` or `openSection`. This can carry stale editor state into the next generated draft.
- **Fix**: Add an editor reset method and call it when confirmed discard happens and/or when a new draft is accepted.
  - Strength: Aligns the guard with Phase 3 and prevents stale prompt/open-section state.
  - Tradeoff: Small hook/interface change across `useCvDraftEditor`, `CvEditor`, and `QuestionnaireFlow`.
  - Confidence: HIGH — state ownership is localized.
  - Blind spot: Manual browser flow not run in this review.
- **Decision**: FIXED — Added `editor.reset()`, changed the guard to prompt only on `editor.hasEdits`, and reset editor state before returning to the questionnaire.

### F2 — Schema-agreement test is incomplete

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/cv-draft-agreement.test.ts:62
- **Detail**: Phase 3 requires agreement tests for every required constraint and optional-empty passing. Current agreement coverage only checks one rejecting full-draft case: empty skill items. It does not verify schema rejection for empty summary body, empty skill label, or empty language name.
- **Fix**: Add agreement cases for summary body, skill label, language name, and optional-empty full draft.
- **Decision**: FIXED — Added agreement cases for summary body, skill group label, skill items, language name, and optional-empty full-draft acceptance; aligned the Zod schema with the editor guards by rejecting whitespace-only required strings.

### F3 — Custom discard dialog lacks focus containment

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/cv/CvEditor.tsx:225
- **Detail**: The modal declares `role="dialog"` and `aria-modal="true"`, but does not trap focus, mark the background inert, or restore focus. Keyboard users can tab behind the overlay, which weakens the Phase 3 accessibility contract.
- **Fix**: Add focus containment and focus restore for the dialog, or replace it with a proper dialog primitive.
  - Strength: Makes the modal semantics match keyboard behavior.
  - Tradeoff: Slightly more UI plumbing unless an existing primitive is introduced.
  - Confidence: MED — implementation choice depends on whether adding a dialog primitive is acceptable.
  - Blind spot: Manual keyboard-only test was not run.
- **Decision**: FIXED — Added initial focus, Tab/Shift+Tab focus containment, Escape cancel handling, and focus restore on dialog unmount.

### F4 — Field errors are not linked to controls

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/cv/CvFormFields.tsx:29
- **Detail**: `TextField` and `TextAreaField` render `role="alert"` errors, but controls do not set `aria-invalid` or `aria-describedby`, so field-level error context may be weaker for assistive tech.
- **Fix**: When `error` exists, add a stable error id, `aria-invalid="true"`, and `aria-describedby`.
- **Decision**: FIXED — Added stable error ids plus `aria-invalid` and `aria-describedby` wiring for `TextField` and `TextAreaField`.

## Verification

- `npx astro sync` — passed
- `npm run lint` — passed
- `npm test -- src/lib/cv-draft-validation.test.ts src/lib/cv-draft-agreement.test.ts` — passed, 2 files / 12 tests
- `npm run build` — passed
- `npx prettier --check src/components/cv/CvEditor.tsx src/components/cv/CvFormFields.tsx src/lib/cv-draft-agreement.test.ts context/changes/cv-template-section-editing/plan.md` — passed

Note: A scoped Prettier check was used instead of repo-wide `npm run format` because the worktree has many unrelated dirty files.
