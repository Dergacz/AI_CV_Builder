# CV Template and Section Editing (S-05) — Plan Brief

> Full plan: `context/changes/cv-template-section-editing/plan.md`
> Decision contract: `context/changes/generation-export-decision-contract/decision-contract.md`

## What & Why

After S-04, a user can generate a CV draft but can only view it read-only. S-05 lets the user review the draft in one clean professional template and correct it — editing, adding, and removing content in all five sections (Summary, Experience, Education, Skills, Languages) — without losing the draft. This is the trust-building step: the generated draft is a starting point, and the user must be able to fix what the generator missed or got wrong.

## Starting Point

The generated draft is held entirely in React state inside `QuestionnaireFlow.tsx` and rendered read-only by `DraftPreview` (`:578-722`), which already has full per-section display logic and empty-state handling. The `GeneratedCvDraft` shape is locked by a Zod schema (`src/lib/cv-draft.ts`). No persistence, no PDF export, and no form library exist yet — the codebase uses custom controlled inputs with `useState` + `cn()`.

## Desired End State

The user sees their CV in a clean template. Each section has an Edit button that swaps just that section into inline form fields with Save/Cancel; users can edit, add, and remove items (including experience highlights and skill items). Saves are blocked only on hard schema violations, so the in-memory draft always stays a valid `GeneratedCvDraft`. Once edits exist, returning to regenerate prompts a discard confirmation. Everything stays client-side; the draft shape is unchanged for S-06/S-07.

## Key Decisions Made

| Decision              | Choice                                                           | Why (1 sentence)                                                                                 | Source         |
| --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| Edit interaction      | Per-section edit toggle (read ↔ inline form + Save/Cancel)       | Keeps the "clean template" review feel and scopes edits to one section.                          | Plan           |
| Item CRUD             | Edit + add + remove array items                                  | Sparse/inaccurate drafts must be fixable in-place, not only via lossy regeneration.              | Plan           |
| Template architecture | Extract a shared `CvTemplate` component                          | S-07 PDF export renders the same structured draft — one reuse point, display logic in one place. | Plan           |
| String handling       | Centralize S-05 copy in one English module (`cv-editor-copy.ts`) | Honors the roadmap convention so S-09 wraps one module instead of combing JSX.                   | Plan + Roadmap |
| Regenerate conflict   | Confirm before discarding edits (dirty flag)                     | Prevents silent loss of editing work, the core trust risk.                                       | Plan           |
| Validation            | Block save only on schema-required fields                        | Keeps the draft valid for S-06/S-07 while staying permissive for low-confidence users.           | Plan           |

## Scope

**In scope:** clean read-only template (extracted, reusable); per-section edit/add/remove for all five sections; schema-required validation; dirty-tracking + regenerate-discard confirmation; centralized English copy module; client-side validation guards that mirror the Zod schema.

**Out of scope:** persistence/save (S-06); PDF export (S-07); i18n catalog / pl-ru translations / language switcher (S-09); drag-and-drop, section reordering, rich text, layout/formatting controls; editing assumptions/warnings; per-section AI regeneration; any schema/generation/API changes.

## Architecture / Approach

Three phases. Phase 1 is a pure refactor: extract the section rendering from `DraftPreview` into a presentational `CvTemplate` and move copy into `cv-editor-copy.ts` — no behavior change. Phase 2 adds an edit controller (likely a `useCvDraftEditor` hook), immutable draft-mutation helpers, zod-free client validation guards (`cv-draft-validation.ts`), and editable section components reusing the existing controlled-input pattern. Phase 3 adds dirty tracking + the regenerate-discard confirmation, a test asserting client guards agree with the Zod schema, and accessibility/empty-state finalization. The client island stays zod-free (type-only `GeneratedCvDraft` import); the Zod schema remains the server-side source of truth.

## Phases at a Glance

| Phase              | What it delivers                                                           | Key risk                                                                                         |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Foundation      | `cv-editor-copy.ts` + reusable read-only `CvTemplate`; preview unchanged   | Behavior drift during extraction — mitigated by "renders identically" check                      |
| 2. Section editing | Per-section edit toggle, validation, edit/add/remove for all five sections | Keeping the draft shape valid through immutable updates; nested arrays (highlights, skill items) |
| 3. Guard + verify  | Regenerate-discard confirmation, schema-agreement test, a11y/empty-states  | Client guards drifting from the Zod schema — covered by the agreement test                       |

**Prerequisites:** S-04 (done). No new dependencies required.
**Estimated effort:** ~2–3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- No test runner is wired in the repo yet; Phase 2/3 unit tests may require adding one (or a minimal script-based assertion).
- A confirm dialog is needed; the plan assumes building it from existing primitives rather than adding a shadcn `dialog` dependency.
- `TextField`/`TextAreaField` may need promoting out of `QuestionnaireFlow` into a shared module for reuse by editors.

## Success Criteria (Summary)

- User reviews their CV in a clean template and can correct any of the five sections (edit/add/remove) without losing the draft.
- Saves never produce an invalid `GeneratedCvDraft`; empty/sparse sections stay renderable.
- The UI does not become a document editor; the draft shape is unchanged for S-06/S-07.
