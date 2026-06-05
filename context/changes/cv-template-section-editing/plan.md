# CV Template and Section Editing (S-05) Implementation Plan

## Overview

Turn the read-only generated CV draft into an editable experience: render the `GeneratedCvDraft` in one clean professional template, and let the user edit, add, and remove content in all five sections (Summary, Experience, Education, Skills, Languages). Editing is per-section (read view ↔ inline edit form with Save/Cancel), schema-safe, and entirely client-side. The `GeneratedCvDraft` object shape is preserved byte-for-byte so S-06 (save) and S-07 (PDF export) consume the edited draft unchanged.

## Current State Analysis

- The draft lives only in React state. `QuestionnaireFlow.tsx` (`src/components/cv/QuestionnaireFlow.tsx:70`) holds `draft: GeneratedCvDraft | null`. There is no persistence route and no `/cv/[id]` page (that is S-06), so editing must live inside this island, after generation, on the same page (`src/pages/cv/new.astro`).
- The read-only renderer already exists. `DraftPreview` (`src/components/cv/QuestionnaireFlow.tsx:578-722`) renders all five sections plus warnings/assumptions with complete empty-state handling. S-05 converts this display into an editable one and first extracts the display half into a reusable component.
- The data contract is locked in Zod. `src/lib/cv-draft.ts` is the single source of truth: `summary.body` is required; `skills[].items` requires `min(1)`; `languages[].name` and `skills[].label` are required strings; everything else on experience/education is optional. `src/types.ts` re-exports the inferred types.
- No form infrastructure is installed. Only `Button` exists under `src/components/ui/`. The established pattern is custom controlled components — `TextField` / `TextAreaField` in `QuestionnaireFlow.tsx:471-520` — using `useState` + `cn()` from `@/lib/utils`. No `react-hook-form`, no shadcn `input`/`textarea`/`form`/`card`. Zod v4 is available.
- String handling has a partial precedent. `src/lib/cv-draft-messages.ts` and `src/lib/landing-content.ts` centralize copy; questionnaire strings are still hardcoded English. S-09 (interface localization, not yet built) will own the en/pl/ru catalog; the roadmap convention is that S-05 registers its strings so nothing is left hard-to-find when S-08 runs.
- The client island deliberately avoids importing zod. `QuestionnaireFlow.tsx:9-12` imports `GeneratedCvDraft` as a type-only import and gets error copy from the zod-free `cv-draft-messages.ts`. S-05 must keep validation logic zod-free on the client (hand-written guards), not import `generatedCvDraftSchema` into the island.

## Desired End State

After generation, the user sees their CV in a single clean professional template. Each of the five sections has an Edit affordance that swaps that section into inline form fields with Save/Cancel. The user can edit existing content, add new items (experience entries, education entries, skill groups, languages, highlights), and remove items. Saving a section is blocked only when a hard schema requirement would be violated (empty summary body, a skill group with zero items, an empty language name, an empty skill-group label). After any edit, attempting to "regenerate" (return to the questionnaire) prompts for confirmation that edits will be discarded. The in-memory `draft` always remains a schema-valid `GeneratedCvDraft`.

Verify by: generating a draft, editing every section, adding/removing items, confirming the rendered template stays clean and the draft object still validates against `generatedCvDraftSchema`, and confirming the regenerate-confirm guard fires only when edits exist.

### Key Discoveries:

- Read-only section rendering to reuse/extract: `src/components/cv/QuestionnaireFlow.tsx:615-697` (the five `DraftSection` blocks) plus helpers `formatExperienceDates` (`:559`), `DraftSection` (`:565`), `EmptyNote` (`:574`).
- Schema constraints that drive validation: `src/lib/cv-draft.ts:42-46` (`skills[].items.min(1)`), `:17-20` (`summary.body` required), `:48-51` (`languages[].name` required).
- Controlled-input pattern to mirror for edit fields: `src/components/cv/QuestionnaireFlow.tsx:471-520`.
- Type-only import discipline for the client island: `src/components/cv/QuestionnaireFlow.tsx:9-12`.

## What We're NOT Doing

- No persistence — no save-to-server, no `/api/cv` write route, no `/cv/[id]` page. That is S-06.
- No PDF export. That is S-07.
- No interface localization system, no language switcher, no pl/ru translations of UI strings. That is S-09. We only centralize S-05's English strings into one module.
- No full document editor: no drag-and-drop, no section reordering, no rich-text formatting, no font/color/layout controls. (F-01 guardrail.)
- No changes to the `GeneratedCvDraft` schema, the generation service, or the `/api/cv/generate` route.
- No editing of `assumptions` or `warnings` (these are generator metadata, displayed read-only).
- No per-section AI regeneration (PRD non-goal); regeneration remains full-CV via the questionnaire.

## Implementation Approach

Three phases, each independently verifiable:

1. **Foundation** — extract the read-only template into a standalone `CvTemplate` component and move all new copy into a `cv-editor-copy.ts` module. This is a pure refactor: `QuestionnaireFlow` renders identically afterward.
2. **Editing** — introduce a per-section edit-mode controller, draft-mutation helpers (immutable updates that preserve shape), client-side validation guards, and editable forms for all five sections including add/remove of array items.
3. **Guard + integration** — add dirty tracking and a confirm-before-discard step on the regenerate path, finalize empty-states/accessibility, and verify the edited draft remains schema-valid end to end.

The edit UI reuses the existing custom controlled-input pattern (no new form library). Editing operates on a working copy held in `QuestionnaireFlow` state; "Save" on a section commits the validated section back into the `draft` object via an immutable update; "Cancel" discards the section's working copy.

## Critical Implementation Details

- **Client stays zod-free.** The editing validation on the client must be hand-written guards (e.g. "summary body non-empty", "skill group has ≥1 non-empty item"), mirroring the constraints in `src/lib/cv-draft.ts` — do not import `generatedCvDraftSchema` into the island, to preserve the type-only import boundary at `QuestionnaireFlow.tsx:9-12`. The schema remains the server-side source of truth; a Phase 3 unit test asserts the client guards and the zod schema agree on the required-field set.
- **State sequencing for Save.** A section's edit form operates on a local working copy. On Save: run the section's guard first; if it fails, set inline errors and do NOT mutate `draft`; only on success commit via an immutable update and close the section. This ordering guarantees `draft` is never transiently invalid.

## Phase 1: Foundation — copy module and shared read-only template

### Overview

Extract the section-rendering logic out of `DraftPreview` into a standalone, presentational `CvTemplate` component, and move S-05's user-facing strings into a centralized copy module. No behavior change: the draft preview looks and behaves exactly as today.

### Changes Required:

#### 1. Centralized copy module

**File**: `src/lib/cv-editor-copy.ts` (new)

**Intent**: Single home for all S-05 user-facing strings (section titles, edit/save/cancel/add/remove labels, empty-state notes, validation messages, regenerate-confirm copy) with English values, so S-09 can later wrap one module per locale instead of combing JSX. Mirrors the shape/role of `src/lib/cv-draft-messages.ts`.

**Contract**: Export a plain object (zod-free, no React) of typed string constants grouped by area (`sections`, `actions`, `validation`, `regenerate`, `emptyStates`). Importable by both the client island and any future server/locale wrapper. No functions beyond optional simple formatters.

#### 2. Shared read-only template component

**File**: `src/components/cv/CvTemplate.tsx` (new)

**Intent**: A presentational component that takes a `GeneratedCvDraft` and renders the clean CV (the five sections, warnings, assumptions) read-only. This is the reuse point S-07 will render to PDF. Moves the rendering logic currently inline in `DraftPreview`.

**Contract**: `export default function CvTemplate({ draft }: { draft: GeneratedCvDraft }): JSX.Element`. Type-only import of `GeneratedCvDraft` (preserve the zod-free island boundary). Carries over `formatExperienceDates`, `DraftSection`, `EmptyNote`, and the five section render blocks (`QuestionnaireFlow.tsx:559-697`) verbatim in behavior, including all empty-state branches. Pulls section titles/empty-state copy from `cv-editor-copy.ts`.

#### 3. Wire DraftPreview to use CvTemplate

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Replace the inline section markup in `DraftPreview` with `<CvTemplate draft={draft} />`, keeping the surrounding header, warnings, assumptions, and the "Edit answers" controls. Remove the now-moved helpers from this file.

**Contract**: `DraftPreview` still receives `{ draft, onEdit }`; visual output unchanged. Helpers `formatExperienceDates`/`DraftSection`/`EmptyNote` are deleted here (now living in `CvTemplate`) or re-imported if shared.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint` (ESLint is type-checked in this repo)
- Production build succeeds: `npm run build`
- Formatting clean: `npm run format`

#### Manual Verification:

- After generating a draft, the preview renders identically to before (all five sections, warnings, assumptions, empty-states).
- No console errors; the island still hydrates (`client:load`) on `/cv/new`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Section editing — per-section toggle, validation, all five sections

### Overview

Add the editing experience: each section renders read-only by default with an Edit button that swaps it into inline form fields with Save/Cancel. Users can edit existing content, add new array items, and remove items. Saving a section is blocked only on hard schema-required violations.

### Changes Required:

#### 1. Edit-mode controller and draft-mutation helpers

**File**: `src/components/cv/QuestionnaireFlow.tsx` (or a new co-located hook `src/components/hooks/useCvDraftEditor.ts`)

**Intent**: Track which section is currently in edit mode, hold the per-section working copy, and commit validated changes back into `draft` immutably. Extracting to a hook keeps `QuestionnaireFlow` readable (per CLAUDE.md hook convention).

**Contract**: Editor state exposes: the active draft, which section key is open (`null | "summary" | "experience" | "education" | "skills" | "languages"`), open/save/cancel handlers, item add/remove handlers per array section, a `hasEdits` dirty flag (consumed in Phase 3), and per-section validation errors. All draft updates are immutable and preserve the `GeneratedCvDraft` shape. No zod import.

#### 2. Editable section components

**File**: `src/components/cv/CvSectionEditor.tsx` (new) and/or editable variants alongside `CvTemplate`

**Intent**: Render inline edit forms per section type using the existing controlled-input pattern. Summary is a single object (headline optional, body required). Experience/Education/Skills/Languages are arrays with add-item / remove-item controls; experience has a nested `highlights` string array (add/remove) and `isCurrent` toggle; skills have a nested `items` string array (≥1 enforced).

**Contract**: One editor per section, each receiving the section slice + change/add/remove/save/cancel callbacks and validation errors. Reuse `TextField`/`TextAreaField` (promote them out of `QuestionnaireFlow` to a shared module if needed). Add buttons follow `Button`/`cn()` conventions. Labels/placeholders come from `cv-editor-copy.ts`.

#### 3. Client-side validation guards

**File**: `src/lib/cv-draft-validation.ts` (new, zod-free) — or co-located in the editor hook

**Intent**: Hand-written guards mirroring the schema's required-field constraints, used to block Save. Kept separate so a Phase 3 test can assert they match the zod schema's required set.

**Contract**: Pure functions, e.g. `validateSummary(s): { body?: string }`, `validateSkillGroup(g)`, `validateLanguage(l)`, returning field→message maps from `cv-editor-copy.ts`. Rules: summary `body` non-empty; each skill group `label` non-empty and ≥1 non-empty `item`; each language `name` non-empty. Optional fields never block. No zod import (preserve island boundary).

#### 4. Swap CvTemplate sections for editable rendering

**File**: `src/components/cv/QuestionnaireFlow.tsx` / `CvTemplate.tsx`

**Intent**: In the post-generation view, render each section through the editor controller so it toggles between `CvTemplate`'s read view and the section editor. Keep one clean template feel — only the actively edited section shows form fields.

**Contract**: Read-only `CvTemplate` remains the default per-section render; when a section is open, its editor replaces just that section. Other sections stay read-only. The header/warnings/assumptions/regenerate controls remain.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Production build succeeds: `npm run build`
- Validation unit tests pass (guards block required-field violations, allow optional-empty): test runner per repo (add if absent) or assert via a small script

#### Manual Verification:

- Each of the five sections can enter edit mode, change content, and Save; Cancel restores prior content.
- Add/remove works for experience entries, education entries, skill groups, languages, experience highlights, and skill items.
- Saving is blocked with an inline message when summary body is emptied, a skill group has no items, a skill-group label is empty, or a language name is empty.
- Only the actively edited section shows a form; the rest stay clean read-only.
- Empty sections show their empty-state with an "Add" affordance and can gain a first item.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Regenerate-conflict guard + integration and verification

### Overview

Protect editing work: once the user has made any edit, returning to the questionnaire to regenerate prompts for confirmation that edits will be discarded. Finalize accessibility/empty-states and verify the edited draft stays schema-valid.

### Changes Required:

#### 1. Dirty tracking and confirm-before-discard

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Use the editor's `hasEdits` flag so the two regenerate affordances ("Edit answers" header button at `QuestionnaireFlow.tsx:595` and "Edit answers and regenerate" footer link at `:712`) prompt for confirmation only when edits exist; otherwise behave as today.

**Contract**: When `hasEdits` is true and the user triggers regenerate, show a confirmation (inline prompt or simple dialog using existing primitives — no new shadcn dependency required) with confirm/cancel; confirm proceeds to `handleEditAnswers` and clears edit state, cancel stays on the editor. Copy from `cv-editor-copy.ts`.

#### 2. Schema-agreement test

**File**: `src/lib/cv-draft-validation.test.ts` (new) or equivalent

**Intent**: Assert the client guards and the zod schema agree on which fields are required, so the two never drift.

**Contract**: A test that constructs draft fragments violating each required constraint, confirms the client guard rejects them, and confirms `generatedCvDraftSchema.safeParse` also rejects the equivalent full draft; and that an optional-empty draft passes both.

#### 3. Accessibility and empty-state finalization

**File**: editor components

**Intent**: Ensure edit toggles, add/remove buttons, and inline errors are labeled and keyboard-accessible, and that every section's empty-state renders cleanly in the template (F-01 requires sparse sections stay renderable).

**Contract**: Buttons have discernible labels; inline validation uses `role`/`aria-live` consistent with existing patterns (`QuestionnaireFlow.tsx:311,321`); focus moves sensibly on open/save/cancel. No layout regressions for empty arrays.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Production build succeeds: `npm run build`
- Validation/agreement tests pass
- Formatting clean: `npm run format`

#### Manual Verification:

- Editing a section then clicking a regenerate affordance prompts confirmation; cancel keeps edits; confirm discards and returns to the questionnaire.
- With no edits, regenerate affordances behave exactly as before (no prompt).
- After a full edit pass (edit + add + remove across all sections), the in-memory draft still satisfies `generatedCvDraftSchema` (spot-check via a dev assertion or temporary log).
- Keyboard-only editing of a section works end to end; empty sections remain renderable.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation. This completes S-05.

---

## Testing Strategy

### Unit Tests:

- Client validation guards: required-field violations rejected, optional-empty accepted (Summary body, skill group label + ≥1 item, language name).
- Schema-agreement: client guards and `generatedCvDraftSchema` agree on the required-field set.

### Integration Tests:

- Manual end-to-end on `/cv/new`: questionnaire → generate → edit every section (edit/add/remove) → confirm draft remains valid → regenerate-confirm guard behavior.

### Manual Testing Steps:

1. Generate a draft from sparse answers; confirm empty sections render with Add affordances.
2. Edit Summary (headline + body); empty the body and confirm Save is blocked.
3. Add and remove an Experience entry; add/remove a highlight; toggle `isCurrent`.
4. Add a Skill group; try to save it with zero items and confirm it's blocked; add an item and save.
5. Add/remove a Language; empty a name and confirm Save is blocked.
6. Make an edit, click "Edit answers and regenerate", confirm the discard prompt appears; cancel and verify edits persist; confirm and verify return to questionnaire.
7. With no edits, click the regenerate affordance and confirm no prompt (unchanged behavior).

## Performance Considerations

Negligible — all editing is client-side in-memory state on a single draft object. Use immutable updates scoped to the edited section to avoid re-rendering the whole template unnecessarily; memoize the read-only `CvTemplate` per section if profiling shows churn (not expected at this data size).

## Migration Notes

None — no schema or persisted data. The `GeneratedCvDraft` shape is unchanged, so S-06/S-07 are unaffected by this slice except that they now receive a possibly user-edited (but still schema-valid) draft.

## References

- Decision contract: `context/changes/generation-export-decision-contract/decision-contract.md` (Editable Sections; S-05 Verification Criteria; Downstream Reuse Map)
- Draft schema (source of truth): `src/lib/cv-draft.ts`
- Existing read-only renderer to extract: `src/components/cv/QuestionnaireFlow.tsx:578-722`
- Controlled-input pattern: `src/components/cv/QuestionnaireFlow.tsx:471-520`
- Centralized-copy precedent: `src/lib/cv-draft-messages.ts`, `src/lib/landing-content.ts`
- Roadmap slice: `context/foundation/roadmap.md` (S-05)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation — copy module and shared read-only template

#### Automated

- [x] 1.1 Type checking passes: `npm run lint` — e747e1b
- [x] 1.2 Production build succeeds: `npm run build` — e747e1b
- [x] 1.3 Formatting clean: `npm run format` — e747e1b

#### Manual

- [x] 1.4 Draft preview renders identically to before (all sections, warnings, assumptions, empty-states) — e747e1b
- [x] 1.5 No console errors; island still hydrates on `/cv/new` — e747e1b

### Phase 2: Section editing — per-section toggle, validation, all five sections

#### Automated

- [x] 2.1 Type checking passes: `npm run lint` — e747e1b
- [x] 2.2 Production build succeeds: `npm run build` — e747e1b
- [x] 2.3 Validation unit tests pass (guards block required-field violations, allow optional-empty) — e747e1b

#### Manual

- [x] 2.4 Each of the five sections can enter edit mode, change content, Save; Cancel restores prior content — e747e1b
- [x] 2.5 Add/remove works for experience entries, education entries, skill groups, languages, highlights, skill items — e747e1b
- [x] 2.6 Save blocked with inline message on empty summary body, zero-item skill group, empty skill-group label, empty language name — e747e1b
- [x] 2.7 Only the actively edited section shows a form; the rest stay clean read-only — e747e1b
- [x] 2.8 Empty sections show empty-state with Add affordance and can gain a first item — e747e1b

### Phase 3: Regenerate-conflict guard + integration and verification

#### Automated

- [x] 3.1 Type checking passes: `npm run lint` — caec0bc
- [x] 3.2 Production build succeeds: `npm run build` — caec0bc
- [x] 3.3 Validation/agreement tests pass — caec0bc
- [x] 3.4 Formatting clean: `npm run format` — caec0bc

#### Manual

- [x] 3.5 Editing then triggering regenerate prompts confirmation; cancel keeps edits; confirm discards and returns to questionnaire — caec0bc
- [x] 3.6 With no edits, regenerate affordances behave as before (no prompt) — caec0bc
- [x] 3.7 After full edit pass, in-memory draft still satisfies `generatedCvDraftSchema` — caec0bc
- [x] 3.8 Keyboard-only editing works end to end; empty sections remain renderable — caec0bc
