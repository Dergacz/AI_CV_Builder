<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Interface Localization

- **Plan**: `context/changes/interface-localization/plan.md`
- **Scope**: Phases 1-4 of 4
- **Date**: 2026-06-07
- **Verdict**: TRIAGED
- **Findings**: 0 critical 2 warnings 2 observations; all decisions resolved 2026-06-07

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | WARNING |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Verification

- `npx astro sync`: PASS
- `npm run test`: PASS, 10 test files and 61 tests
- `npm run lint`: PASS, with existing Astro parser `projectService` warnings
- `npm run build`: PASS, with non-fatal existing CSS minify, chunk size, and sitemap `site` warnings
- Route-prefix guard: PASS, no `prefixDefaultLocale`, `redirectToDefaultLocale`, `astro:i18n`, `[lang]`, or `[locale]` route migration found
- CV output coupling guard: PASS, no `ui_locale`, `UI_LOCALE_COOKIE`, or `locale` coupling found in CV questionnaire/draft/generation modules
- Stale English UI guard: PASS, no target stale English strings found in `src/components` or `src/pages`
- Auth prose redirect guard: PASS, no stale raw auth prose redirect pattern found

## Findings

### F1 — Language switching can discard unsaved CV work

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/cv/new.astro:19`, `src/pages/cv/[id].astro:48`
- **Detail**: The CV edit screens render the Astro `LanguageSwitcher`, which submits a full POST and redirect. On `/cv/new` this can lose in-memory questionnaire answers, generated draft state, selected output language, and unsaved section edits. On `/cv/[id]` it can lose unsaved reopened-CV edits or title changes.
- **Fix A Recommended**: Use a React-aware language switcher on stateful CV screens that prompts or blocks when dirty.
  - Strength: Preserves S-09 language switching without data loss.
  - Tradeoff: Non-trivial because dirty state lives across questionnaire, editor, and save hooks.
  - Confidence: HIGH — the current full reload path is visible in `LanguageSwitcher.astro`.
  - Blind spot: Browser smoke was not re-run in this review.
- **Fix B**: Remove the switcher from CV edit screens and keep switching on non-stateful shells.
  - Strength: Fast and safe for MVP state preservation.
  - Tradeoff: Less convenient localization from inside the edit flow.
  - Confidence: MEDIUM — depends how strict "global shell/header locations" should be interpreted.
  - Blind spot: Product expectation for switching mid-edit is not explicitly settled.
- **Decision**: FIXED with Fix B on 2026-06-07. Removed the full-page language switcher from `/cv/new` and `/cv/[id]` for MVP so in-memory CV work cannot be discarded by switching UI language mid-edit.

### F2 — Name-only saved title fallback writes durable English grammar

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/lib/cv-library-copy.ts:167`
- **Detail**: `defaultCvTitle()` is interface-locale-independent, but the fallback `"{name}'s CV — date"` is durable English text. The plan required durable title text to follow CV output language or an explicit neutral fallback.
- **Fix**: Change the fallback to neutral durable text, e.g. `"{name} — {date}"`, and update `cv-language-boundary.test.ts`.
- **Decision**: FIXED on 2026-06-07. The name-only fallback now uses neutral durable text: `"{name} — {date}"`.

### F3 — React islands select catalogs internally instead of receiving copy props

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/components/cv/QuestionnaireFlow.tsx:33`
- **Detail**: The plan preferred typed copy props at island boundaries, but several islands receive `locale` and call `getMessages()` or copy selectors internally. Behavior is deterministic, but it is plan drift and bundles broader catalog access into client islands.
- **Fix**: Either document this as an accepted implementation addendum or refactor the main islands to receive typed copy props.
- **Decision**: ACCEPTED DEVIATION on 2026-06-07. Current behavior is deterministic and does not introduce functional issues for MVP.

### F4 — Unknown API error buckets can render no localized message

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/components/hooks/useCvSave.ts:78`
- **Detail**: Client code indexes localized error maps directly from `data.error`. If a stale endpoint or future API drift returns an unknown bucket, the UI can set an undefined error message.
- **Fix**: Use fallback lookups such as `errors[data.error] ?? errors.service_unavailable` and `genErrors[data.error] ?? genErrors.generation_failed`.
- **Decision**: FIXED on 2026-06-07. Unknown save/generation error buckets now fall back to localized `service_unavailable` copy.
