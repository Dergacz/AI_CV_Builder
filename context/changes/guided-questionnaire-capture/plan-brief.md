# Guided Questionnaire Capture — Plan Brief

> Full plan: `context/changes/guided-questionnaire-capture/plan.md`

## What & Why

Build the first real CV-start flow: a protected guided questionnaire where signed-in users answer simple questions and review the captured input. This unlocks S-04 by giving generation a stable, versioned input shape without adding generation, persistence, or editor scope early.

## Starting Point

The product landing and account access slices are in place. `/dashboard` is protected and already shows a disabled "Start CV" action, but there is no `/cv/new` route, questionnaire UI, answer contract, generation route, or saved-CV persistence.

## Desired End State

Signed-in users can open `/cv/new`, move through guided steps, provide required name and target/goal fields, select a future CV output language, add optional structured details, and review answers. Sparse input is allowed with gentle warnings, and the flow clearly stops before draft generation.

## Key Decisions Made

| Decision             | Choice                                             | Why (1 sentence)                                                                      |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Route                | Protected `/cv/new`                                | It matches the product object and leaves `/dashboard` reusable for saved CVs.         |
| Flow shape           | Guided steps                                       | It keeps the blank-page experience calm for low-confidence users.                     |
| Required minimum     | Name plus target/goal                              | It preserves low friction while giving S-04 enough anchor data.                       |
| Answer storage       | Client React state only                            | It respects S-03 scope and avoids early persistence for sensitive questionnaire data. |
| Question set         | Structured essentials plus one freeform prompt     | It balances generation usefulness with simple-language UX.                            |
| Finish state         | Review answers screen                              | It gives S-03 a real end state without faking AI generation.                          |
| Language handling    | CV output language field only                      | It satisfies the F-01 generation contract without pulling in full UI i18n.            |
| Validation and error | Inline validation only, no server validation route | It matches the client-only scope and keeps sparse optional sections allowed.          |

## Scope

**In scope:**

- Protected `/cv/new` route.
- Dashboard "Start CV" link to `/cv/new`.
- Typed questionnaire version, output language, and answer shape.
- React guided step flow with local state.
- Required full name and target/goal validation.
- Optional experience, education, skills/tools, spoken languages, and extra context fields.
- Review answers screen with sparse-input guidance.

**Out of scope:**

- AI generation, generated CV drafts, prompts, loading/retry states, or mock draft content.
- Supabase migrations, saved CV APIs, save/reopen/delete behavior, or generated DB types.
- Browser storage, server storage, analytics events, or raw answer logging.
- PDF export, CV template rendering, section editing, and full UI localization.

## Architecture / Approach

Add a small `src/lib/cv-questionnaire.ts` contract module and a protected `src/pages/cv/new.astro` route that renders `src/components/cv/QuestionnaireFlow.tsx` as a React island. Middleware protects the `/cv` prefix, the dashboard links into `/cv/new`, and all questionnaire state stays in the component until S-04 introduces generation.

## Phases at a Glance

| Phase                                        | What it delivers                                  | Key risk                                                 |
| -------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| 1. Questionnaire Contract And Route Boundary | Answer contract, protected route, dashboard link  | Route protection or answer shape drifts from future S-04 |
| 2. Guided Questionnaire UI                   | Step flow, local state, validation, language pick | UI starts feeling like a long resume form                |
| 3. Review Answers End State                  | Read-only review and sparse-input guidance        | Review accidentally implies generation already exists    |
| 4. Verification And Change Metadata          | Repo gates, scope checks, progress updates        | Scope creep into persistence/generation goes unnoticed   |

**Prerequisites:** S-01 and S-02 are complete; F-01 and F-02 contracts are available for handoff constraints.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- The first questionnaire version may need small shape changes during S-04 prompt design, but S-03 should still establish the initial contract.
- Client-only state means refresh loses answers; this is accepted for S-03 to avoid early persistence of sensitive data.
- UI copy remains English until the later lightweight i18n slice.

## Success Criteria (Summary)

- Signed-in users can complete `/cv/new` from guided basics through review.
- Signed-out users are redirected away from `/cv/new`.
- S-03 does not add generation, persistence, browser answer storage, saved-CV routes, or PDF/export scope.
