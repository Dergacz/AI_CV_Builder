# Full Saved PDF Flow (S-08) Implementation Plan

## Overview

Prove the north-star MVP flow end to end: a signed-in user starts a CV, generates a structured draft, edits named sections, saves it, reopens it from the dashboard, edits again, exports the current reviewed CV as PDF, and can do this with English, Polish, and Russian output. This is roadmap slice **S-08 `full-saved-pdf-flow`** and should stay an integration-proof slice with targeted fixes, not a new feature slice.

## Current State Analysis

All prerequisite slices are implemented. The app already has protected CV routes, guided questionnaire capture, OpenAI generation, section editing, owner-only saved CV persistence, browser-side PDF export, and lightweight UI localization.

### Key Discoveries:

- `context/foundation/roadmap.md` marks S-08 ready with prerequisites F-01, F-02, S-06, S-07, and S-09 complete.
- The F-01 decision contract requires S-08 to verify selected output language preservation through generation, editing, saving, and export, and to avoid deep localization or country-specific CV rules (`context/changes/generation-export-decision-contract/decision-contract.md:261`).
- `/cv/new` renders `QuestionnaireFlow client:only="react"` and passes the resolved interface locale into the creation flow (`src/pages/cv/new.astro:27`).
- `/cv/[id]` loads an owned CV server-side, then hydrates `SavedCvView client:only="react"` with `draft`, `sourceSnapshot.answers`, `cvId`, `title`, and `locale` (`src/pages/cv/[id].astro:56`).
- Both creation and reopen paths converge on `CvEditor`, which exposes section editing, save, export, warnings, assumptions, and localized UI chrome (`src/components/cv/CvEditor.tsx:41`).
- `useCvSave` switches from POST to PUT after the first save and ignores server prose in favor of localized error buckets (`src/components/hooks/useCvSave.ts:57`).
- `useCvExport` renders the current on-screen draft, dynamically imports `@react-pdf/renderer`, and passes `outputLanguage` so exported PDF content follows the CV output language, not UI locale (`src/components/hooks/useCvExport.ts:49`).
- `listCvs` selects only content-free summaries, while `getCv` restores the full draft and `source_snapshot` for the reopen route (`src/lib/services/cv-repository.ts:80`, `src/lib/services/cv-repository.ts:93`).
- The current test suite covers individual pieces, but there is no single S-08 contract test or smoke checklist that proves the joined flow as the north-star journey.

## Desired End State

A reviewer can run a documented smoke path proving: signed-in creation, generation, edit, explicit save, dashboard listing, reopen, second edit, export of the current on-screen draft, and deletion/error handling all work together. The same structured draft shape supports English, Polish, and Russian output. UI language remains independent from CV output language, and save/export status copy is clear enough that exporting an unsaved edit is not confused with saving it.

Verify by:

- automated S-08 contract tests covering language/save/reopen/export invariants,
- a checked manual smoke checklist for representative UI/output language combinations,
- focused failure and browser checks,
- repo gates passing sequentially,
- `change.md`, roadmap status surfaces, and the mapped Linear issue synced during closure.

## What We're NOT Doing

- No new CV features: no answer editing on reopen, no regenerate from saved CV, no autosave, no stored PDFs, no second template, no document layout editor.
- No deep localization: no country-specific CV rules, locale-prefixed routes, localized date/number formats, or resume norms.
- No server-side PDF route, queue, worker, external PDF service, storage bucket, or background job.
- No broad dashboard redesign or landing/auth changes.
- No exhaustive 3x3 language matrix or full browser/device matrix; S-08 uses representative proof plus targeted export checks.

## Implementation Approach

Treat S-08 as a thin integration and verification layer over existing features. First create a small contract-test and smoke-checklist harness that captures the flow invariants. Then run the full journey in the browser and fix only defects exposed by the journey. Finally verify the major joined failure states and focused browser/export behavior before executing the closure bundle.

The plan intentionally allows exporting the current on-screen draft even if it has unsaved edits. S-08 must verify that save status and export status are visually and semantically distinct, so a user does not interpret "PDF exported" as "CV saved".

## Critical Implementation Details

### Browser-Side PDF Boundary

Do not move `/cv/new` or `/cv/[id]` back to `client:load`. S-07 found that `client:only="react"` is the working boundary that keeps `@react-pdf/renderer` out of the Cloudflare Worker server bundle. Any route or island change in S-08 must preserve that isolation and re-run the build/bundle check.

### Source Answers Boundary

`source_snapshot.answers` is contract data used to preserve the save/reopen shape. S-08 verifies it round-trips and remains owner-scoped, but does not expose original questionnaire answers or add answer-edit behavior on reopened CVs.

### Linear Closure

S-08 maps to the Linear roadmap item created during the original roadmap migration (expected issue `CV-14`). The closure phase must verify the mapping by reading the Linear issue before mutating it, then move the issue to Done only after the repo and roadmap closure artifacts are correct.

## Phase 1: Contract And Smoke Harness

### Overview

Create the narrow automated and manual harness for proving S-08. This phase should not change product behavior unless a small testability helper is needed.

### Changes Required:

#### 1. Full-flow contract test

**File**: `src/lib/cv-full-flow-contract.test.ts`

**Intent**: Add a cheap, deterministic test layer for the most important S-08 invariants without introducing browser e2e infrastructure.

**Contract**: Use the existing generated draft fixture and current helpers/services to assert that `draft.language` is the source of saved summary language, `source_snapshot.answers.outputLanguage` survives the save/reopen contract shape, default saved titles remain neutral/durable, and export filename/content-language helpers remain independent from interface locale. Keep the test pure or repository-helper-level; do not require a live Supabase instance or PDF byte generation.

#### 2. Smoke checklist artifact

**File**: `context/changes/full-saved-pdf-flow/smoke-checklist.md`

**Intent**: Provide an execution checklist for the north-star browser proof so implementation records actual evidence instead of relying on chat memory.

**Contract**: Include the representative matrix: one full path in Chrome, each CV output language at least once, and at least two UI/output mismatches. Include the happy path, unsaved-edit export clarity check, save/reopen/delete checks, major failure checks, focused Safari/Firefox/Edge/mobile export checks, and bundle isolation check.

#### 3. Existing test-plan alignment

**File**: `context/foundation/test-plan.md`

**Intent**: Register S-08 as the integration proof that consumes existing risk areas rather than replacing the project test strategy.

**Contract**: Add a short cookbook or rollout note only if needed. It should reference the smoke checklist and keep the existing risk strategy intact: cheap deterministic tests first, browser checks only for PDF/full-flow risks.

### Success Criteria:

#### Automated Verification:

- `src/lib/cv-full-flow-contract.test.ts` exists and passes with `npm run test -- src/lib/cv-full-flow-contract.test.ts`.
- `npm run test` passes with the new contract test included.
- `npm run lint` passes after adding the test and checklist.

#### Manual Verification:

- `smoke-checklist.md` is specific enough for a human or agent to execute without reopening the planning thread.
- The checklist includes at least one full Chrome path, all three CV output languages, at least two UI/output mismatches, and the unsaved-edit export clarity check.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the checklist is the right proof shape before running the full smoke.

---

## Phase 2: Full Flow Integration Proof

### Overview

Execute the happy path and fix any integration defects found while keeping scope limited to S-08.

### Changes Required:

#### 1. Creation-to-export smoke execution

**File**: `context/changes/full-saved-pdf-flow/smoke-checklist.md`

**Intent**: Run and record the full north-star path.

**Contract**: Execute: sign in, open `/cv/new`, choose a CV output language, complete required answers, generate draft, edit a section, save, confirm dashboard listing, reopen `/cv/[id]`, edit again, export PDF, confirm the exported content reflects the current on-screen draft and selected output language. Record date, browser, UI locale, CV output language, and any defect/fix notes.

#### 2. Targeted flow fixes

**File**: `src/components/cv/QuestionnaireFlow.tsx`, `src/components/cv/CvEditor.tsx`, `src/components/cv/SavedCvView.tsx`, `src/components/cv/SavedCvList.tsx`, `src/pages/cv/new.astro`, `src/pages/cv/[id].astro`, `src/pages/dashboard.astro` as needed

**Intent**: Fix only defects exposed by the full path.

**Contract**: Keep fixes narrow: state reset/dirty-state clarity, save/export status copy, route/link issues, localized label mismatches, or current-draft export mismatch. Do not add new feature surfaces. Preserve `client:only="react"` on `/cv/new` and `/cv/[id]`.

#### 3. Representative language matrix

**File**: `context/changes/full-saved-pdf-flow/smoke-checklist.md`

**Intent**: Prove the CV output language survives the full joined flow without exhaustive repetition.

**Contract**: Mark evidence for each CV output language at least once (`en`, `pl`, `ru`), and include at least two UI/output mismatches, such as Polish UI exporting an English CV and English UI exporting a Russian CV. Verify stored saved-card language labels are localized display labels keyed by stored output language, not a mutation of the stored value.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes after any targeted fixes.
- `npm run lint` passes after any targeted fixes.
- Scope guard confirms no new broad feature surfaces were introduced: `rg -n "autosave|template marketplace|cover letter|job description|section reorder|localStorage|sessionStorage" src context/changes/full-saved-pdf-flow`.

#### Manual Verification:

- Full Chrome happy path passes from `/cv/new` through PDF export.
- Export after an unsaved edit uses the current on-screen draft, while save status and export status remain clearly distinct.
- Saving twice updates the same CV instead of creating duplicates.
- Reopened `/cv/[id]` hides edit-answers/regenerate behavior and still supports section edits, save, and export.
- Representative language matrix passes: each CV output language is generated/saved/exported at least once, and at least two UI/output mismatches preserve the intended boundary.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation of the full-flow smoke evidence before failure/browser hardening.

---

## Phase 3: Failure And Browser Hardening

### Overview

Verify the major joined failure paths and focused browser/export behavior required for confidence in the saved PDF flow.

### Changes Required:

#### 1. Major failure smoke

**File**: `context/changes/full-saved-pdf-flow/smoke-checklist.md`; source files only if defects are found

**Intent**: Confirm the joined flow fails clearly without losing user work or leaking private CV data.

**Contract**: Exercise or simulate: generation unavailable, save failure, missing/non-owned reopen, and export failure. Confirm user-facing copy uses stable localized buckets where available, the CV remains visible for export failures, save failures do not create false saved state, and missing/non-owned CVs return to the dashboard without exposing content.

#### 2. Focused browser/export checks

**File**: `context/changes/full-saved-pdf-flow/smoke-checklist.md`; `src/components/cv/CvPdfDocument.tsx` or export helpers only if defects are found

**Intent**: Reconfirm the PDF and font behavior after full-flow integration.

**Contract**: Run the full path once in Chrome. Then run targeted export/open checks in Safari, Firefox, Edge, and one mobile viewport or mobile browser. Verify Polish diacritics and Russian Cyrillic are readable, first-export loading is acceptable, and current-draft edits appear in the PDF.

#### 3. Bundle isolation check

**File**: `context/changes/full-saved-pdf-flow/smoke-checklist.md`

**Intent**: Ensure S-08 did not regress the S-07 Worker bundle boundary.

**Contract**: After `npm run build`, inspect the server output for `@react-pdf/renderer`/react-pdf code outside client asset references. Record the command and result in the checklist. If the library enters the server bundle, fix the island/import boundary before closure.

### Success Criteria:

#### Automated Verification:

- `npm run test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Build-output inspection confirms `@react-pdf/renderer` is absent from the server/SSR application bundle.

#### Manual Verification:

- Generation unavailable, save failure, missing/non-owned reopen, and export failure states are checked and recorded.
- Export failure keeps the edited CV visible and retryable.
- Chrome full path plus Safari/Firefox/Edge/mobile targeted export checks are recorded.
- English, Polish, and Russian PDF text renders correctly after the joined flow.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that failure and browser evidence is sufficient for north-star closure.

---

## Phase 4: Closure Bundle

### Overview

Run the full repo gates and close S-08 consistently across the change folder, roadmap, and Linear.

### Changes Required:

#### 1. Full repo verification

**File**: generated verification output only

**Intent**: Run the same repo gates used for prior roadmap-backed closeouts.

**Contract**: Run sequentially, not concurrently: `npx astro sync`, `npm run test`, `npm run lint`, `npm run build`. If Supabase/Miniflare/Astro produces transient lock behavior, rerun cleanly before treating it as a product defect.

#### 2. Change metadata and progress

**File**: `context/changes/full-saved-pdf-flow/change.md`, `context/changes/full-saved-pdf-flow/plan.md`

**Intent**: Mark the change state accurately after implementation.

**Contract**: During implementation, `/10x-implement` flips Progress checkboxes as work lands. After all criteria pass, set `change.md` to `status: implemented` and update `updated` to the closure date.

#### 3. Roadmap status surfaces

**File**: `context/foundation/roadmap.md`

**Intent**: Close the live roadmap item everywhere it appears.

**Contract**: Update the S-08 row in "At a glance", S-08 detail block, Backlog Handoff, downstream notes/open questions if any, and Done section consistently. Do not edit `context/archive/`.

#### 4. Linear status sync

**Tool**: Linear MCP

**Intent**: Keep tracker state aligned with repo state.

**Contract**: Read back the mapped S-08 issue (expected `CV-14` from the roadmap migration), verify title/roadmap mapping, update it to `Done`, then read it back again and record the verified state in the closeout notes or final response. Do not mutate Linear before repo gates and roadmap updates are complete.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`.
- Full test suite passes: `npm run test`.
- Lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- `context/changes/full-saved-pdf-flow/plan.md` and `plan-brief.md` exist and the Progress section remains parseable.

#### Manual Verification:

- `smoke-checklist.md` is fully executed for the agreed matrix and failure/browser checks.
- `context/changes/full-saved-pdf-flow/change.md` is `status: implemented` only after all Progress items are complete.
- `context/foundation/roadmap.md` marks S-08 done across all status surfaces.
- Linear S-08 issue is verified as Done by readback.

**Implementation Note**: This phase completes S-08. Do not mark the roadmap or Linear done before the browser smoke and repo gates have passed.

---

## Testing Strategy

### Unit Tests:

- `src/lib/cv-full-flow-contract.test.ts`: S-08 invariants around draft language, saved summary language, `source_snapshot.answers.outputLanguage`, neutral durable title behavior, and export language/filename helper independence.
- Existing tests remain part of the safety net: i18n catalog coverage, CV language boundary, draft validation/agreement, save API body-size guard, export filename/error helpers.

### Integration Tests:

- No new browser e2e framework. The plan follows `context/foundation/test-plan.md`: use cheap deterministic tests for contract drift and manual/browser checks where PDF/full-flow behavior needs real UI evidence.
- API/security confidence remains grounded in existing saved-CV route tests and manual cross-account/missing-CV smoke checks.

### Manual Testing Steps:

1. Sign in and open `/cv/new`.
2. Switch UI locale as needed for the representative matrix without changing route prefixes.
3. Choose a CV output language, complete required answers, and generate a draft.
4. Edit at least one section and save.
5. Return to `/dashboard`; verify the saved card title, updated date, and localized output-language label.
6. Open the saved CV at `/cv/[id]`; edit a different section and save again.
7. Make one additional unsaved edit and export; confirm the PDF reflects the current on-screen draft while saved/export statuses remain distinct.
8. Repeat enough of the path to cover all three CV output languages and two UI/output mismatches.
9. Simulate/check generation unavailable, save failure, missing/non-owned reopen, and export failure states.
10. Run focused export checks in Safari, Firefox, Edge, and one mobile viewport/browser.

## Performance Considerations

S-08 should not add new runtime work to the normal page load. Preserve lazy PDF loading, `client:only="react"` island boundaries for CV screens, content-free dashboard listing, and synchronous generation/export behavior already established by earlier slices. If first-export latency is unacceptable during smoke, record and fix within the existing browser-side export architecture before considering any new infrastructure.

## Migration Notes

No database migration is planned for S-08. Existing `public.cvs` rows keep their persisted `draft`, `source_snapshot`, title, language, and timestamps. Existing route shape remains unprefixed.

## References

- Roadmap S-08: `context/foundation/roadmap.md`
- PRD success criteria and FR-009/FR-010/FR-011/FR-014/FR-015: `context/foundation/prd.md`
- F-01 decision contract: `context/changes/generation-export-decision-contract/decision-contract.md`
- F-02 persistence/privacy contract: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`
- Saved CV research and plan: `context/changes/saved-cv-library/research.md`, `context/changes/saved-cv-library/plan.md`
- PDF export research and plan: `context/changes/pdf-export/research.md`, `context/changes/pdf-export/plan.md`
- Interface localization plan: `context/changes/interface-localization/plan.md`
- Test strategy: `context/foundation/test-plan.md`
- Joined editor surface: `src/components/cv/CvEditor.tsx:41`
- Creation route island: `src/pages/cv/new.astro:27`
- Reopen route island: `src/pages/cv/[id].astro:56`
- Save hook: `src/components/hooks/useCvSave.ts:57`
- Export hook: `src/components/hooks/useCvExport.ts:49`
- Saved-CV repository: `src/lib/services/cv-repository.ts:80`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract And Smoke Harness

#### Automated

- [x] 1.1 `src/lib/cv-full-flow-contract.test.ts` exists and passes with `npm run test -- src/lib/cv-full-flow-contract.test.ts` — 073253a
- [x] 1.2 `npm run test` passes with the new contract test included — 073253a
- [x] 1.3 `npm run lint` passes after adding the test and checklist — 073253a

#### Manual

- [x] 1.4 `smoke-checklist.md` is specific enough for a human or agent to execute without reopening the planning thread — 073253a
- [x] 1.5 The checklist includes one full Chrome path, all three CV output languages, at least two UI/output mismatches, and the unsaved-edit export clarity check — 073253a

### Phase 2: Full Flow Integration Proof

#### Automated

- [x] 2.1 `npm run test` passes after any targeted fixes
- [x] 2.2 `npm run lint` passes after any targeted fixes
- [x] 2.3 Scope guard confirms no broad feature surfaces were introduced

#### Manual

- [x] 2.4 Full Chrome happy path passes from `/cv/new` through PDF export — 2e73180
- [x] 2.5 Export after an unsaved edit uses the current on-screen draft while save and export statuses remain distinct — 2e73180
- [x] 2.6 Saving twice updates the same CV instead of creating duplicates — 2e73180
- [x] 2.7 Reopened `/cv/[id]` hides edit-answers/regenerate behavior and still supports section edits, save, and export — 2e73180
- [x] 2.8 Representative language matrix passes across all output languages and at least two UI/output mismatches — 2e73180

### Phase 3: Failure And Browser Hardening

#### Automated

- [x] 3.1 `npm run test` passes — 2e73180
- [x] 3.2 `npm run lint` passes — 2e73180
- [x] 3.3 `npm run build` passes — 2e73180
- [x] 3.4 Build-output inspection confirms `@react-pdf/renderer` is absent from the server/SSR application bundle — 2e73180

#### Manual

- [x] 3.5 Generation unavailable, save failure, missing/non-owned reopen, and export failure states are checked and recorded — 2e73180
- [x] 3.6 Export failure keeps the edited CV visible and retryable — 2e73180
- [x] 3.7 Chrome full path plus Safari/Firefox/Edge/mobile targeted export checks are recorded — 2e73180
- [x] 3.8 English, Polish, and Russian PDF text renders correctly after the joined flow — 2e73180

### Phase 4: Closure Bundle

#### Automated

- [x] 4.1 Astro types regenerate: `npx astro sync` — b3b92aa
- [x] 4.2 Full test suite passes: `npm run test` — b3b92aa
- [x] 4.3 Lint passes: `npm run lint` — b3b92aa
- [x] 4.4 Production build passes: `npm run build` — b3b92aa
- [x] 4.5 `context/changes/full-saved-pdf-flow/plan.md` and `plan-brief.md` exist and the Progress section remains parseable — b3b92aa

#### Manual

- [x] 4.6 `smoke-checklist.md` is fully executed for the agreed matrix and failure/browser checks — b3b92aa
- [x] 4.7 `context/changes/full-saved-pdf-flow/change.md` is `status: implemented` only after all Progress items are complete — b3b92aa
- [x] 4.8 `context/foundation/roadmap.md` marks S-08 done across all status surfaces — b3b92aa
- [x] 4.9 Linear S-08 issue is verified as Done by readback — b3b92aa
