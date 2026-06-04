# Guided Questionnaire Capture Implementation Plan

## Overview

Implement roadmap slice S-03 by giving authenticated users a protected `/cv/new` flow where they can answer a calm, guided questionnaire in simple language and review the captured answers before draft generation exists. This change creates the input surface and typed answer contract that S-04 can consume later; it does not generate, save, export, or persist CV data.

## Current State Analysis

The app has a product landing page, Supabase-backed account access, and a protected `/dashboard` workspace shell. The dashboard currently shows a disabled "Start CV" action and says the guided questionnaire comes next, so S-03 should convert that visible next step into a real protected route.

There is no product CV route, questionnaire component, generation route, saved-CV table, or answer contract in source code yet. Existing interactive UI is implemented as React islands rendered from Astro pages, and route protection is centralized in middleware rather than duplicated inside pages.

## Desired End State

Signed-in users can open `/cv/new` from the workspace, move through a guided multi-step questionnaire, provide required name and target/goal fields, choose the future CV output language, add optional structured details, and land on a read-only review screen. Sparse optional sections are allowed and surfaced gently, matching the F-01 minimal-input contract.

Signed-out users cannot access `/cv/new`. The final review state clearly says draft generation comes next and does not fake AI generation, create an API call, write to Supabase, or save browser storage.

### Key Discoveries:

- The workspace shell already has the S-03 entry point as a disabled "Start CV" button: `src/pages/dashboard.astro:37`.
- Protected routes are centralized through `PROTECTED_ROUTES`, currently only `"/dashboard"`: `src/middleware.ts:4`.
- Existing React form islands use client-side state and validation while preserving Astro route shells: `src/components/auth/SignUpForm.tsx:14`.
- The shared shadcn button helper exists for React UI controls: `src/components/ui/button.tsx:35`.
- F-01 requires generation to preserve `questionnaireVersion` and selected output language in the future `GeneratedCvDraft`: `context/changes/generation-export-decision-contract/decision-contract.md:31`.
- F-01 minimal-input behavior says sparse answers should produce warnings rather than fabricated facts: `context/changes/generation-export-decision-contract/decision-contract.md:168`.
- F-02 treats questionnaire answers as sensitive and forbids raw answer logging: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md:188`.

## What We're NOT Doing

- No AI generation route, OpenAI call, prompt implementation, loading state for generation, retry behavior, or generated CV draft.
- No Supabase migration, `public.cvs` table, saved-CV API route, saved-CV library, save/reopen/delete behavior, or generated database types.
- No `localStorage`, `sessionStorage`, cookies, analytics events, or other browser/server persistence for questionnaire answers.
- No PDF export, CV template rendering, section editing, persisted PDF storage, storage buckets, queues, workers, or background processing.
- No full EN/PL/RU UI language switcher, deep localization, country-specific CV norms, or translated questionnaire UI.
- No old CV upload/import, job-description tailoring, cover letters, billing, teams, sharing, public links, or admin roles.
- No roadmap status update or Linear status sync during implementation; closure is a separate step after verification.

## Implementation Approach

Keep S-03 as a narrow route-and-UI slice. Add a protected `/cv/new` Astro page that renders a React questionnaire island with local component state only. The answer shape should live in a small source module with a stable `QUESTIONNAIRE_VERSION` and `CvQuestionnaireAnswers` type so S-04 can plan generation against one known input contract.

The dashboard should stop presenting "Start CV" as disabled and instead link to `/cv/new`. The questionnaire should use guided steps rather than a single long form: basics and output language, experience/education, skills/languages, final context, then review. Required validation applies only to full name and target/goal; optional sparse sections remain allowed and produce gentle review warnings.

## Critical Implementation Details

### Sensitive answer boundary

Questionnaire answers are private CV source material. S-03 should not log raw answer payloads, send them to an API route, persist them in browser storage, or include them in URLs; answer state lives only in the React component for the active page session.

### S-04 handoff contract

The questionnaire source module must preserve `questionnaireVersion` and selected output language, because F-01 requires future generation to know both. S-03 should end at review rather than adding a disabled or fake generation action that looks broken.

## Phase 1: Questionnaire Contract And Route Boundary

### Overview

This phase defines the small questionnaire answer contract, creates the protected `/cv/new` route shell, and wires the existing workspace start action to it.

### Changes Required:

#### 1. Questionnaire Contract Module

**File**: `src/lib/cv-questionnaire.ts`

**Intent**: Provide one typed source for the questionnaire version, supported CV output languages, answer shape, and simple review metadata. This keeps S-04 from inventing a second input format.

**Contract**: Export `QUESTIONNAIRE_VERSION` with value `mvp-v1`, `cvOutputLanguages` as `["en", "pl", "ru"]`, `CvOutputLanguage`, and `CvQuestionnaireAnswers`. The answer shape must include required `fullName`, required `targetRoleOrGoal`, required `outputLanguage`, optional structured text fields for experience, education, skills/tools, spoken languages, and one optional `additionalContext` field.

#### 2. Protected CV Route Boundary

**File**: `src/middleware.ts`

**Intent**: Protect the questionnaire route through the existing centralized middleware pattern.

**Contract**: Add a CV route prefix to `PROTECTED_ROUTES`, preferably `"/cv"` so `/cv/new` and future CV subroutes inherit the same guard. Do not add auth checks inside the Astro page.

#### 3. New Questionnaire Page

**File**: `src/pages/cv/new.astro`

**Intent**: Create the S-03 route shell and render the React questionnaire island inside the existing layout.

**Contract**: Use `Layout` with a product-specific title. Render the questionnaire component with `client:load`. Do not read or write Supabase data from this page.

#### 4. Workspace Start Link

**File**: `src/pages/dashboard.astro`

**Intent**: Turn the visible "Start CV" action into the real S-03 entry point.

**Contract**: Replace the disabled button with an anchor to `/cv/new`. Update workspace status copy so "Guided questionnaire" reads as available or active, while saved CVs remain planned for S-06.

### Success Criteria:

#### Automated Verification:

- `src/lib/cv-questionnaire.ts` exports `QUESTIONNAIRE_VERSION`, supported output languages, and `CvQuestionnaireAnswers`.
- `src/middleware.ts` protects `/cv/new` through `PROTECTED_ROUTES`.
- `src/pages/cv/new.astro` exists and renders a React questionnaire island with `client:load`.
- `src/pages/dashboard.astro` links "Start CV" to `/cv/new` and no longer leaves it disabled.
- Lint passes: `npm run lint`.

#### Manual Verification:

- Signed-out `/cv/new` redirects to `/auth/signin`.
- Signed-in `/dashboard` shows "Start CV" as an active link.
- Following "Start CV" opens `/cv/new`.

**Implementation Note**: After this phase and automated verification, pause for manual confirmation that route protection and workspace navigation behave correctly before building the full flow.

---

## Phase 2: Guided Questionnaire UI

### Overview

This phase builds the client-only guided questionnaire flow with local React state, simple steps, required basics validation, and optional sparse sections.

### Changes Required:

#### 1. Questionnaire React Component

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Implement the interactive guided flow while keeping answer state inside the component.

**Contract**: Use React state for the active step and `CvQuestionnaireAnswers`. Do not use `localStorage`, `sessionStorage`, cookies, form POST, fetch, Supabase, URL query params, or console logging for answers.

#### 2. Step Structure

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Keep the questionnaire calm and approachable by showing one small group of questions at a time.

**Contract**: Provide these steps:

- Basics: required full name, required target role/goal, output language selection.
- Experience and education: optional plain-language fields.
- Skills and languages: optional skills/tools and spoken-languages fields.
- Extra context: optional "anything else we should know" field.
- Review: read-only summary handled in Phase 3.

#### 3. Output Language Selection

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Capture the future CV output language required by F-01 without adding UI localization.

**Contract**: Render English, Polish, and Russian as selectable CV output language options backed by `CvOutputLanguage`. Default to English unless the component intentionally requires explicit selection. The surrounding UI copy remains English.

#### 4. Inline Required Validation

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Prevent completion without the agreed minimum input while keeping optional sections low-friction.

**Contract**: Block leaving the Basics step for review completion only when `fullName` or `targetRoleOrGoal` is blank after trimming. Show inline, field-level messages. Do not block users for empty experience, education, skills, languages, or extra context.

#### 5. UI Styling And Accessibility

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Match the current product direction and keep the flow usable on mobile and desktop.

**Contract**: Use restrained slate/emerald styling consistent with the landing/workspace pages, visible step progress, clear Back/Next controls, labeled inputs, accessible radio/segmented controls for language, and stable responsive dimensions that prevent button text or progress labels from overlapping.

### Success Criteria:

#### Automated Verification:

- Questionnaire state is component-local and source search finds no `localStorage`, `sessionStorage`, answer `fetch`, or Supabase usage in `QuestionnaireFlow.tsx`.
- Basics validation trims required fields and does not require optional sections.
- Output language state is limited to `en`, `pl`, or `ru`.
- Lint passes: `npm run lint`.

#### Manual Verification:

- User can move forward and backward through guided steps without losing in-memory answers.
- Blank full name or blank target/goal shows inline validation and blocks continuing from Basics.
- Sparse optional sections are allowed.
- The flow is readable and non-overlapping on mobile and desktop widths.

**Implementation Note**: After this phase, pause for manual confirmation that the questionnaire feels like a guided start, not a professional resume form.

---

## Phase 3: Review Answers End State

### Overview

This phase completes S-03 with a read-only review screen that summarizes captured answers, surfaces sparse-input guidance, and clearly stops before draft generation.

### Changes Required:

#### 1. Review Screen

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Give S-03 a concrete end state users can understand before S-04 exists.

**Contract**: Render a read-only summary of full name, target/goal, output language, and all optional sections with empty states where the user skipped content. Provide an edit/back affordance that returns to the relevant step or previous guided step without clearing state.

#### 2. Sparse Input Warnings

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Set expectations honestly when optional sections are sparse while preserving F-01's allowed minimal-input behavior.

**Contract**: Show gentle review warnings when major optional groups are empty. Warnings should explain that the future draft may be more conservative or ask for review later; they must not block completion or imply the app invented missing facts.

#### 3. Generation Boundary Message

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Make the roadmap boundary visible without adding fake generation behavior.

**Contract**: End with clear copy that draft generation comes next. Do not render an enabled or disabled "Generate draft" primary action, call an API, show fake loading, or create mock generated CV content.

#### 4. Page-Level Support Copy

**File**: `src/pages/cv/new.astro`

**Intent**: Frame `/cv/new` as the questionnaire step in the product flow.

**Contract**: Surround the React island with concise Astro-rendered heading/support copy. The page should not promise save, PDF export, or generation in S-03.

### Success Criteria:

#### Automated Verification:

- Review screen renders from the same `CvQuestionnaireAnswers` state shape used by the guided steps.
- Source search confirms no generation route, generation API call, mock generated CV draft, or saved-CV route was added.
- Lint passes: `npm run lint`.

#### Manual Verification:

- Completing required basics and skipping optional sections reaches review.
- Review accurately shows entered answers and marks skipped optional groups.
- Sparse optional answers show gentle non-blocking warnings.
- Review messaging clearly says draft generation comes next without presenting fake generation.

**Implementation Note**: After this phase, pause for manual confirmation that the review state is an acceptable S-03 stopping point.

---

## Phase 4: Verification And Change Metadata

### Overview

This phase runs the repo gates and updates only this change's planning/progress metadata. It deliberately does not mark S-03 done in the roadmap or sync Linear.

### Changes Required:

#### 1. Astro Type Sync

**File**: `.astro/`

**Intent**: Regenerate Astro types if required by the new route/component structure.

**Contract**: Run `npx astro sync`. Treat generated type updates as verification output, not a product-scope expansion.

#### 2. Repository Gates

**File**: `package.json`

**Intent**: Verify the S-03 changes against the repo's current gates.

**Contract**: Run `npm run lint` and `npm run build`. Do not introduce a new test runner or test script.

#### 3. Scope Guard Searches

**File**: `src/`

**Intent**: Confirm S-03 did not quietly absorb generation, persistence, or export work.

**Contract**: Search source for new generation endpoints, Supabase writes for CV/questionnaire data, browser storage for answers, and PDF/export code. Any such addition should be removed unless explicitly approved as a scope change.

#### 4. Change Metadata And Progress

**File**: `context/changes/guided-questionnaire-capture/change.md`

**Intent**: Keep this change's state accurate during implementation.

**Contract**: During implementation, update this change's `change.md` and `plan.md` progress according to the 10x progress convention. Do not update `context/foundation/roadmap.md` to done until S-03 has been reviewed and accepted.

### Success Criteria:

#### Automated Verification:

- Astro types sync successfully: `npx astro sync`.
- Lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Source search confirms no generation API, saved-CV persistence, browser answer storage, or PDF export was added.

#### Manual Verification:

- Signed-out users cannot access `/cv/new`.
- Signed-in users can navigate from `/dashboard` to `/cv/new`.
- The guided questionnaire works from required basics through review.
- Refreshing `/cv/new` loses in-progress answers, confirming S-03 did not add persistence.
- `context/foundation/roadmap.md` remains unchanged by S-03 implementation.

**Implementation Note**: After this phase, pause for manual confirmation before treating S-03 as implemented or syncing roadmap/tracker status in a separate closure action.

---

## Testing Strategy

### Unit Tests:

- No unit test runner exists in this repo yet, and S-03 does not introduce one.

### Integration Tests:

- Use current repository gates: `npx astro sync`, `npm run lint`, and `npm run build`.
- Use source search to confirm S-03 did not add generation, persistence, browser answer storage, or PDF/export scope.
- Use source search to confirm `/cv` is centrally protected through middleware.

### Manual Testing Steps:

1. Visit `/cv/new` signed out and confirm middleware redirects to `/auth/signin`.
2. Sign in and open `/dashboard`.
3. Confirm "Start CV" links to `/cv/new`.
4. Open `/cv/new` and confirm the questionnaire route renders.
5. Try continuing with blank full name and blank target/goal; confirm inline validation appears.
6. Enter full name, target/goal, and output language, then move through all guided steps.
7. Leave optional sections empty and confirm review remains reachable.
8. Enter optional experience, education, skills/tools, spoken languages, and extra context; confirm review shows the answers accurately.
9. Use Back/Edit navigation and confirm in-memory answers remain during the session.
10. Refresh `/cv/new` and confirm in-progress answers are not persisted.
11. Verify the review screen does not generate, save, export, or show mock CV content.
12. Resize to mobile and desktop widths; confirm progress, controls, and text do not overlap.

## Performance Considerations

S-03 should add only one React island on `/cv/new`. Keep the questionnaire lightweight, with local state and static content; avoid heavy client libraries, network calls, polling, storage synchronization, or app-wide state.

## Migration Notes

No database migration is required. No Supabase Auth migration is required. Adding `/cv` to the existing protected-route list is the only route-protection change.

## References

- Roadmap S-03 outcome: `context/foundation/roadmap.md:122`.
- PRD FR-004 and FR-005 questionnaire requirements: `context/foundation/prd.md:62`.
- Current workspace "Start CV" placeholder: `src/pages/dashboard.astro:37`.
- Protected route boundary: `src/middleware.ts:4`.
- Existing React validation pattern: `src/components/auth/SignUpForm.tsx:14`.
- Existing React button helper: `src/components/ui/button.tsx:35`.
- F-01 questionnaire/version/language contract: `context/changes/generation-export-decision-contract/decision-contract.md:31`.
- F-01 minimal-input behavior: `context/changes/generation-export-decision-contract/decision-contract.md:168`.
- F-02 private questionnaire logging boundary: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md:188`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Questionnaire Contract And Route Boundary

#### Automated

- [x] 1.1 `src/lib/cv-questionnaire.ts` exports `QUESTIONNAIRE_VERSION`, supported output languages, and `CvQuestionnaireAnswers` — b2c1023
- [x] 1.2 `src/middleware.ts` protects `/cv/new` through `PROTECTED_ROUTES` — b2c1023
- [x] 1.3 `src/pages/cv/new.astro` exists and renders a React questionnaire island with `client:load` — b2c1023
- [x] 1.4 `src/pages/dashboard.astro` links "Start CV" to `/cv/new` and no longer leaves it disabled — b2c1023
- [x] 1.5 Lint passes: `npm run lint` — b2c1023

#### Manual

- [x] 1.6 Signed-out `/cv/new` redirects to `/auth/signin` — b2c1023
- [x] 1.7 Signed-in `/dashboard` shows "Start CV" as an active link — b2c1023
- [x] 1.8 Following "Start CV" opens `/cv/new` — b2c1023

### Phase 2: Guided Questionnaire UI

#### Automated

- [x] 2.1 Questionnaire state is component-local and source search finds no `localStorage`, `sessionStorage`, answer `fetch`, or Supabase usage in `QuestionnaireFlow.tsx`
- [x] 2.2 Basics validation trims required fields and does not require optional sections
- [x] 2.3 Output language state is limited to `en`, `pl`, or `ru`
- [x] 2.4 Lint passes: `npm run lint`

#### Manual

- [x] 2.5 User can move forward and backward through guided steps without losing in-memory answers
- [x] 2.6 Blank full name or blank target/goal shows inline validation and blocks continuing from Basics
- [x] 2.7 Sparse optional sections are allowed
- [x] 2.8 The flow is readable and non-overlapping on mobile and desktop widths

### Phase 3: Review Answers End State

#### Automated

- [ ] 3.1 Review screen renders from the same `CvQuestionnaireAnswers` state shape used by the guided steps
- [ ] 3.2 Source search confirms no generation route, generation API call, mock generated CV draft, or saved-CV route was added
- [ ] 3.3 Lint passes: `npm run lint`

#### Manual

- [ ] 3.4 Completing required basics and skipping optional sections reaches review
- [ ] 3.5 Review accurately shows entered answers and marks skipped optional groups
- [ ] 3.6 Sparse optional answers show gentle non-blocking warnings
- [ ] 3.7 Review messaging clearly says draft generation comes next without presenting fake generation

### Phase 4: Verification And Change Metadata

#### Automated

- [ ] 4.1 Astro types sync successfully: `npx astro sync`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Production build passes: `npm run build`
- [ ] 4.4 Source search confirms no generation API, saved-CV persistence, browser answer storage, or PDF export was added

#### Manual

- [ ] 4.5 Signed-out users cannot access `/cv/new`
- [ ] 4.6 Signed-in users can navigate from `/dashboard` to `/cv/new`
- [ ] 4.7 The guided questionnaire works from required basics through review
- [ ] 4.8 Refreshing `/cv/new` loses in-progress answers, confirming S-03 did not add persistence
- [ ] 4.9 `context/foundation/roadmap.md` remains unchanged by S-03 implementation
