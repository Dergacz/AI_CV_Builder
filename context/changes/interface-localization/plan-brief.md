# Interface Localization - Plan Brief

> Full plan: `context/changes/interface-localization/plan.md`

## What & Why

S-09 adds English, Polish, and Russian interface localization to the whole visible app UI. This unlocks the final S-08 saved PDF flow by making landing, auth, dashboard, questionnaire, review, save, export, and major error states usable in all supported interface languages.

## Starting Point

The repo already has localization-ready copy modules for landing, editor, saved-CV library, export, generation errors, and save errors. The missing pieces are locale resolution, persistence, a language switcher, Polish/Russian catalog content, and migration of remaining inline page/island strings.

## Desired End State

Users can switch UI language globally, the choice persists in a `ui_locale` cookie, and routes stay unchanged (`/dashboard`, `/cv/new`, `/auth/signin`). UI chrome follows the selected interface language while CV output language, saved CV language, generated draft content, and exported CV content remain governed by the CV output language contract.

## Key Decisions Made

| Decision           | Choice                                        | Why (1 sentence)                                                                 |
| ------------------ | --------------------------------------------- | -------------------------------------------------------------------------------- |
| Persistence        | Cookie only                                   | Works for signed-out and signed-in pages without DB/profile scope.               |
| Route shape        | Keep unprefixed routes                        | Avoids broad middleware, auth redirect, and link migration.                      |
| Switcher placement | Global header/shell placement                 | Lets users recover language choice anywhere in the flow.                         |
| Error handling     | Stable error codes + localized display        | Keeps server contracts stable and lets UI display errors in the current locale.  |
| Translation scope  | Full visible UI + major errors                | Matches roadmap wording for the whole app interface.                             |
| CV/PDF boundary    | CV content language wins for durable/exported | Prevents interface locale from corrupting generated or exported CV content.      |
| Verification       | Existing gates + targeted tests + smoke       | Covers cross-cutting risk without adding a new test framework.                   |
| Rollout            | 4 phases                                      | Keeps infrastructure, pages, islands, and verification independently reviewable. |

## Scope

**In scope:**

- `ui_locale` cookie, locale resolver, `Astro.locals.locale`, localized `<html lang>`.
- Global language switcher across landing/auth/dashboard/CV shell areas.
- English, Polish, and Russian catalog entries for visible UI and major errors.
- Localized Astro pages, auth forms, questionnaire, editor, saved-CV library, save/export/delete UI.
- Stable auth error codes and localized display.
- Tests for locale resolution, catalog coverage, auth error mapping, and CV/UI language boundary.

**Out of scope:**

- Locale-prefixed routes.
- Database/account preference for interface language.
- Deep localization such as country-specific resume norms, date/number/currency formats, or cultural CV adaptation.
- Changes to OpenAI generation behavior, PRD non-goals, or CV output language storage.

## Architecture / Approach

Add `src/lib/i18n/` as a typed, static message layer. Middleware resolves `ui_locale` from a path-wide cookie, stores it in `Astro.locals.locale`, and pages select localized catalog branches before rendering. React islands receive localized copy through props or a small explicit copy boundary, not by reading hidden global state.

## Phases at a Glance

| Phase | What it delivers                                   | Key risk                                         |
| ----- | -------------------------------------------------- | ------------------------------------------------ |
| 1     | Locale contract, cookie, locals, layout, switcher  | Accidentally disturbing auth cookies or routes   |
| 2     | Localized Astro pages and stable auth error codes  | Mixed language in auth/dashboard shell           |
| 3     | Localized React CV flow islands                    | Coupling UI locale to CV output/exported content |
| 4     | Tests, boundary guards, and en/pl/ru browser smoke | Missing edge states or stale English copy        |

**Prerequisites:** S-01, S-02, and S-03 are complete; S-04 through S-07 are also complete in the current roadmap.
**Estimated effort:** ~4 implementation phases across 3-5 focused sessions, depending on translation QA depth.

## Open Risks & Assumptions

- Polish and Russian copy quality needs human review beyond type/build correctness.
- Some generated/model-provided warnings or assumptions may remain draft content rather than UI chrome; implementation must classify these carefully.
- Browser smoke needs an authenticated account and enough service availability to exercise save/export flows.

## Success Criteria (Summary)

- Every major visible app surface renders in English, Polish, and Russian with no route prefix changes.
- UI language persists across refresh/navigation and controls `<html lang>`.
- Changing UI language does not change CV output language, saved CV language, generated content, or exported CV content.

## Browser Smoke Checklist (en / pl / ru)

Run the full path once per interface language. Switch language from the global shell switcher; the URL
must stay unprefixed (`/`, `/auth/signin`, `/dashboard`, `/cv/new`, `/cv/[id]`) throughout.

1. **Landing** (`/`): copy localizes; `<html lang>` matches the selected locale.
2. **Auth — signin** (`/auth/signin`): submit empty/invalid fields → localized validation; trigger a
   failed signin → localized error from a stable code (not raw prose in the URL).
3. **Auth — signup** (`/auth/signup`) and **confirm-email**: headers and copy localize.
4. **Dashboard** (`/dashboard`): workspace chrome and saved-CV library copy localize.
5. **Questionnaire** (`/cv/new`): steps, labels, validation, review, sparse warnings, loading, and
   retry states localize; switching language keeps the route `/cv/new`.
6. **CV output ≠ UI language**: pick an output language different from the UI locale, generate a draft,
   and confirm UI chrome follows the UI language while generated content follows the output language.
7. **Editor**: section UI, edit controls, save/export controls, dialogs, and empty states localize.
8. **Save & reopen**: save the CV, reopen from `/dashboard`; saved-CV actions/errors localize while the
   saved CV's output-language label is preserved.
9. **Delete dialog**: localized confirm/cancel and any delete error copy.
10. **Export**: export button/status/error copy follows the UI language; the exported PDF's content and
    section headings follow the CV output language, not the UI locale.
11. **Persistence**: refresh and navigate — the chosen UI language survives and URLs remain unprefixed.

Prerequisite: an authenticated account and enough service availability to exercise generate/save/export.
