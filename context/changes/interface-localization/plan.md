# Interface Localization Implementation Plan

## Overview

Implement roadmap slice S-09 by adding a lightweight interface localization layer for English, Polish, and Russian across the full visible app UI. The plan keeps existing unprefixed routes, persists the selected interface language in a separate `ui_locale` cookie, passes typed copy into Astro pages and React islands, and preserves the existing distinction between interface language and per-CV output language.

## Current State Analysis

The app already has several localization-ready copy boundaries, but no actual interface language resolver or switcher. `src/lib/landing-content.ts` defines `en`, `pl`, and `ru` locale types, but only English content is populated and `ProductLanding.astro` consumes a singleton `landingContent`. S-05, S-06, and S-07 also prepared copy modules for later localization: `cv-editor-copy.ts`, `cv-library-copy.ts`, and `cv-export-copy.ts` centralize much of the editor, saved-CV, and export UI copy.

The remaining app surface still has substantial inline English text in Astro pages, auth forms, the questionnaire flow, dashboard status copy, and server/API error responses. The current route architecture is unprefixed and middleware protects `/dashboard` and `/cv`, so route-prefix i18n would force a broader link, redirect, and route-protection migration than S-09 needs.

Context7 documentation lookup for Astro confirmed that built-in Astro i18n is route-oriented: it supports configured `locales`, `defaultLocale`, route prefix settings such as `prefixDefaultLocale`, redirects/fallbacks, and optional `astro:i18n` middleware. For this repo, that is heavier than the roadmap scope because S-09 is UI-string translation, not localized route architecture.

## Desired End State

Users can switch the application interface between English, Polish, and Russian from the app shell on landing, auth, dashboard, questionnaire, review, saved-CV, and export surfaces. The selected interface language persists across signed-out and signed-in pages via a `ui_locale` cookie, `<html lang>` matches the selected UI language, and major user-facing errors render in the same language.

CV output language remains independent. Changing UI language must not mutate `answers.outputLanguage`, `draft.language`, saved CV `language`, generated draft content, or exported CV content. Durable/exported CV text follows the CV output language contract or an explicit neutral fallback, not the current interface locale.

### Key Discoveries:

- `src/lib/landing-content.ts:1` already defines `landingLocales = ["en", "pl", "ru"]`, but `landingContentByLocale` currently contains only English content and exports a singleton at `src/lib/landing-content.ts:105`.
- `src/middleware.ts:4` protects unprefixed `/dashboard` and `/cv` paths, and `src/middleware.ts:20` redirects unauthenticated users to `/auth/signin`.
- `src/layouts/Layout.astro:14` hardcodes `<html lang="en">`; this must become locale-aware.
- `src/env.d.ts:1` currently types only `App.Locals.user`; it needs locale locals added when middleware resolves UI language.
- `src/components/cv/QuestionnaireFlow.tsx:27` through `src/components/cv/QuestionnaireFlow.tsx:467` contains the largest inline copy surface, including steps, labels, validation, warnings, loading, and button text.
- `src/pages/api/auth/signin.ts:4` and `src/pages/api/auth/signup.ts:4` return raw user-facing prose through query params; S-09 should shift these redirects to stable error codes displayed through localized copy.
- `src/components/cv/SavedCvList.tsx:17` has output-language labels for saved CV cards; these are UI labels for the saved CV's content language and should be localized without changing the stored `cv.language`.
- `src/lib/cv-library-copy.ts:63` generates default saved-CV titles. These are durable user data, so the implementation must explicitly decide how title copy follows the CV output language boundary rather than silently following interface locale.

## What We're NOT Doing

- No Astro route-prefix migration such as `/en/dashboard`, `/pl/dashboard`, or `/ru/dashboard`.
- No database migration, profile table, account setting, or Supabase user metadata for interface language.
- No country-specific resume norms, date/number/currency localization, address formats, or cultural CV adaptation.
- No changes to OpenAI generation prompts or the `CvOutputLanguage` contract except where UI labels describe that existing choice.
- No template marketplace, additional CV templates, full document editor, billing, uploads, cover letters, or other PRD non-goals.
- No new test framework. Use the existing Vitest and repo verification gates.

## Implementation Approach

Use a small typed i18n module under `src/lib/i18n/` that exports the supported UI locales, locale resolver, cookie name, and a complete message catalog keyed by `en`, `pl`, and `ru`. Middleware resolves `context.locals.locale` from `ui_locale`, defaults to English, and leaves Supabase auth cookies untouched. Pages read the locale from `Astro.locals`, select copy from the catalog, render a shared language switcher, and pass the selected copy into React islands.

The app should prefer explicit copy props at island boundaries over importing mutable global locale state. This keeps server rendering deterministic and makes hydration behavior obvious. Existing copy modules can either be folded into the unified catalog or re-export locale-specific copy from the new i18n module, but the public contract should make it easy for implementers to select copy by `UiLocale`.

## Critical Implementation Details

### Routing Boundary

Do not enable Astro's built-in route-prefix i18n for this slice. Context7-confirmed Astro i18n routing would be useful for localized URLs, but this app already has unprefixed route protection, links, form actions, and auth redirects. S-09 should keep route shape stable and localize UI via a cookie-backed catalog.

### CV Language Boundary

Do not reuse interface-locale copy blindly inside exported or durable CV content. `CvPdfDocument` currently consumes editor copy for section headings, and `defaultCvTitle()` creates saved title data; both areas need explicit treatment so UI language does not accidentally override CV output language.

### Error Contract

Do not keep passing translated prose through auth `?error=` query params. Auth redirects should use stable error codes, and pages should resolve those codes through the selected UI locale. API JSON responses can keep a `message` for compatibility during the slice, but client UI should prefer stable buckets where available.

## Phase 1: Locale Contract, Cookie, And Shell Switcher

### Overview

Create the locale infrastructure without migrating every screen at once. This phase establishes supported UI locales, cookie persistence, middleware locals, localized `<html lang>`, and a reusable language switcher that can be placed in existing shell/header areas.

### Changes Required:

#### 1. Locale Contract And Resolver

**File**: `src/lib/i18n/locales.ts`

**Intent**: Define the canonical UI locale contract and cookie behavior in a zod-free, framework-light module that both middleware and UI code can import.

**Contract**: Export `uiLocales`, `defaultUiLocale`, `type UiLocale`, `UI_LOCALE_COOKIE`, `isUiLocale(value)`, `resolveUiLocale(value)`, and `localeLabels`. `resolveUiLocale()` must return English for missing or unsupported values.

#### 2. Message Catalog Entry Point

**File**: `src/lib/i18n/messages.ts`

**Intent**: Provide a single typed entry point for localized UI copy so pages and islands select copy by locale instead of importing English singletons.

**Contract**: Export a `messagesByLocale` object keyed by every `UiLocale`, a `type UiMessages`, and `getMessages(locale: UiLocale)`. At the end of Phase 1 this can contain shell/global copy plus placeholders for groups migrated in later phases, but the type must require every supported locale.

#### 3. Middleware Locale Resolution

**File**: `src/middleware.ts`

**Intent**: Resolve the UI locale once per request alongside the existing Supabase user lookup.

**Contract**: Read `UI_LOCALE_COOKIE` from `context.cookies`, set `context.locals.locale`, and preserve existing auth behavior for `PROTECTED_ROUTES`. Do not change protected route paths or redirect targets.

#### 4. App Locals Type

**File**: `src/env.d.ts`

**Intent**: Type the new middleware-local locale so Astro pages can safely read `Astro.locals.locale`.

**Contract**: Add `locale: import("@/lib/i18n/locales").UiLocale` to `App.Locals` without changing the existing `user` type.

#### 5. Localized Layout Shell

**File**: `src/layouts/Layout.astro`

**Intent**: Make document language and global config banner copy locale-aware.

**Contract**: Accept optional `locale?: UiLocale` and localized `title?: string`; default from `Astro.locals.locale` when not provided. Render `<html lang={locale}>`. Config banner labels should come from the message catalog rather than hardcoded Polish fallback text.

#### 6. Language Switcher Component

**File**: `src/components/LanguageSwitcher.astro`

**Intent**: Provide a reusable app-shell control for switching interface language while staying on the current route.

**Contract**: Render one accessible form or link group that sets `ui_locale` to `en`, `pl`, or `ru` and returns to the current path/query without changing route shape. The selected language must be visibly and semantically identified.

#### 7. Locale Update Endpoint

**File**: `src/pages/api/locale.ts`

**Intent**: Persist the selected interface locale from the switcher without adding client JavaScript or route prefixes.

**Contract**: Export a `POST` handler that validates the submitted locale with `resolveUiLocale()`, sets `UI_LOCALE_COOKIE`, and redirects to a safe same-origin `returnTo` path or `/`. The cookie should be long-lived, path-wide, `sameSite: "lax"`, and not overwrite Supabase cookies.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Locale resolver tests pass: `npm run test -- src/lib/i18n/locales.test.ts`
- Type/lint gate passes for Phase 1 files: `npm run lint`
- Production build passes: `npm run build`

#### Manual Verification:

- Switching language writes `ui_locale` and stays on the same unprefixed route.
- `<html lang>` changes between `en`, `pl`, and `ru`.
- Existing auth protection for `/dashboard` and `/cv` still redirects signed-out users to `/auth/signin`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Astro Pages, Auth, And Server Error Codes

### Overview

Localize the server-rendered Astro page shell and convert auth redirect errors from raw English prose to stable error codes displayed through the selected UI locale.

### Changes Required:

#### 1. Landing Catalog Completion

**File**: `src/lib/landing-content.ts`

**Intent**: Replace the English-only landing singleton with locale-indexed landing copy for English, Polish, and Russian.

**Contract**: Keep the existing `LandingContent` shape, populate `landingContentByLocale.en`, `.pl`, and `.ru`, and export a selector such as `getLandingContent(locale: UiLocale)`. Remove or deprecate the singleton `landingContent` only after all imports are migrated.

#### 2. Product Landing Locale Wiring

**File**: `src/components/ProductLanding.astro`

**Intent**: Render landing copy based on the resolved UI locale and include the global language switcher in the landing header.

**Contract**: Accept `locale` and/or `content` props from `src/pages/index.astro`, use localized nav/hero/process/trust copy, and keep signed-in/signed-out CTA destinations unchanged.

#### 3. Home Page Locale Wiring

**File**: `src/pages/index.astro`

**Intent**: Select localized landing content and title from `Astro.locals.locale`.

**Contract**: Pass the selected locale/copy into `Layout` and `ProductLanding`. Do not add localized route variants.

#### 4. Auth Page Catalog

**File**: `src/lib/i18n/messages.ts`

**Intent**: Add auth page, form, validation, password toggle, and auth error messages to the typed catalog.

**Contract**: Include copy for signin, signup, confirm-email success/pending states, form labels/placeholders/buttons, client validation messages, password hints, and stable auth error code labels for all three locales.

#### 5. Auth Pages Locale Wiring

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Render localized auth page copy and pass localized form copy into React form islands.

**Contract**: Read `Astro.locals.locale`, resolve `messages.auth`, pass copy props into `SignInForm` and `SignUpForm`, and render localized `Layout title`. Confirm-email must localize both dev auto-confirmed and email-confirmation variants.

#### 6. Auth Form Copy Props

**Files**: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/SubmitButton.tsx`

**Intent**: Remove inline auth UI strings from client components.

**Contract**: `SignInForm` and `SignUpForm` accept typed copy props for labels, placeholders, validation messages, submit text, pending text, server error text, password visibility labels, and password hints. `PasswordToggle` should accept localized visible/hidden labels or receive them through props.

#### 7. Stable Auth Error Codes

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`

**Intent**: Stop passing raw prose in `?error=` so localized pages can choose display text at render time.

**Contract**: Redirect with stable codes such as `auth_unavailable`, `signin_failed`, `signup_failed`, and `rate_limited`. Keep redirect destinations unprefixed. Auth pages map unknown codes to a generic localized error.

#### 8. Dashboard And CV Page Catalog

**File**: `src/lib/i18n/messages.ts`

**Intent**: Add localized copy for dashboard workspace shell, status panel, `/cv/new` header, and `/cv/[id]` header.

**Contract**: Include all visible page headings, aria labels, CTAs, signed-in label, status labels/values, load unavailable text, and page titles for `en`, `pl`, and `ru`.

#### 9. Dashboard And CV Page Wiring

**Files**: `src/pages/dashboard.astro`, `src/pages/cv/new.astro`, `src/pages/cv/[id].astro`

**Intent**: Replace inline page copy with localized catalog selections and pass locale/copy into child islands.

**Contract**: Keep links and route targets unchanged. Pass copy props to `SavedCvList`, `QuestionnaireFlow`, and `SavedCvView` as needed for Phase 3 compatibility.

### Success Criteria:

#### Automated Verification:

- Auth error code tests pass: `npm run test -- src/lib/i18n/auth-errors.test.ts`
- Existing auth pages and API routes lint cleanly: `npm run lint`
- Production build passes: `npm run build`
- Scope guard finds no raw auth prose in query redirects: `rg "encodeURIComponent\\((AUTH_|SIGNIN_|SIGNUP_|RATE_).*MESSAGE|getSign(In|Up)ErrorMessage" src/pages/api/auth` returns no stale raw-message redirect pattern.

#### Manual Verification:

- Landing, signin, signup, confirm-email, dashboard, `/cv/new`, and `/cv/[id]` headers render in English, Polish, and Russian.
- Auth form validation messages render in the selected UI language.
- Failed signin/signup displays localized error copy from a stable error code.
- Language switcher appears in the global shell/header locations without crowding mobile layouts.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: React CV Flow Islands

### Overview

Localize the interactive React surfaces: questionnaire, generated draft review/editor, save/export/delete controls, saved CV list, validation messages, loading states, and major client-visible errors.

### Changes Required:

#### 1. Questionnaire Copy Catalog

**File**: `src/lib/i18n/messages.ts`

**Intent**: Add complete questionnaire copy for all supported UI locales.

**Contract**: Include step labels/titles/bodies, field labels/placeholders, output-language UI labels, validation messages, review labels, sparse warnings, loading text, error suffixes, progress labels, buttons, aria labels, and empty review fallback.

#### 2. Questionnaire Copy Props

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Remove inline UI strings from the questionnaire and make it render by selected UI locale.

**Contract**: Accept a typed `copy` prop and use it for all UI chrome. Keep `answers.outputLanguage`, `cvOutputLanguages`, `QUESTIONNAIRE_VERSION`, generation payload, and draft handling unchanged. The UI label for output-language choices is localized, but the stored values remain `en`, `pl`, and `ru`.

#### 3. Editor, Library, Export, Draft, And Save Catalogs

**Files**: `src/lib/cv-editor-copy.ts`, `src/lib/cv-library-copy.ts`, `src/lib/cv-export-copy.ts`, `src/lib/cv-draft-messages.ts`, `src/lib/cv-save-messages.ts`, `src/lib/i18n/messages.ts`

**Intent**: Convert existing English singleton copy modules into locale-selectable copy while preserving their zod-free, React-free import safety.

**Contract**: Each copy surface must be selectable by `UiLocale` or exposed through the unified `UiMessages` catalog. Server and client code must be able to import the needed copy without pulling React, Supabase, or zod into client bundles.

#### 4. CV Editor Copy Props

**Files**: `src/components/cv/CvEditor.tsx`, `src/components/cv/CvTemplate.tsx`, `src/components/cv/CvSectionEditors.tsx`, `src/components/cv/ConfirmDialog.tsx`

**Intent**: Localize generated draft UI chrome, section editor controls, validation, dialogs, and empty states.

**Contract**: Pass localized copy into `CvEditor` and through to `CvTemplate`/section editors where needed. `ConfirmDialog` remains generic and receives localized labels from callers. Warnings and assumptions generated by the model may remain draft content, not UI chrome, unless they are existing app-generated messages.

#### 5. Save And Export Hook Copy

**Files**: `src/components/hooks/useCvSave.ts`, `src/components/hooks/useCvExport.ts`, `src/components/cv/CvEditor.tsx`

**Intent**: Ensure save/export fallback messages and status announcements use localized UI copy.

**Contract**: Hooks should accept copy or stable message maps rather than importing English singletons. Export action/progress/done/failure copy must be localized while the exported CV document remains governed by CV output language.

#### 6. Saved CV List And Reopen View Copy Props

**Files**: `src/components/cv/SavedCvList.tsx`, `src/components/cv/SavedCvView.tsx`, `src/pages/dashboard.astro`, `src/pages/cv/[id].astro`

**Intent**: Localize saved-CV list actions, delete dialog, output-language labels, error messages, and reopened editor UI.

**Contract**: `SavedCvList` receives localized copy and content-language labels. `SavedCvView` passes localized editor/save/export copy into `CvEditor`. Stored `cv.language` remains unchanged and only its display label is localized.

#### 7. CV API User-Facing Error Buckets

**Files**: `src/pages/api/cv/generate.ts`, `src/pages/api/cv/index.ts`, `src/pages/api/cv/[id].ts`, `src/components/cv/QuestionnaireFlow.tsx`, `src/components/hooks/useCvSave.ts`, `src/components/cv/SavedCvList.tsx`

**Intent**: Localize major API-driven UI errors without leaking provider or database detail.

**Contract**: Prefer stable `error` buckets in API responses and localized client display when the client has a matching bucket. Keep response shape compatible with existing `message` consumers during the transition, but do not let new UI depend on English-only server prose.

#### 8. Durable/Exported CV Text Boundary

**Files**: `src/lib/cv-library-copy.ts`, `src/components/cv/CvPdfDocument.tsx`, `src/components/hooks/useCvExport.ts`

**Intent**: Prevent interface language from accidentally changing durable saved titles or exported CV content.

**Contract**: Default title generation and PDF headings must be explicitly tied to CV output language or a documented neutral fallback. Interface-locale copy may control export button/status/errors, but not the content language of the generated/exported CV.

### Success Criteria:

#### Automated Verification:

- Catalog coverage tests pass: `npm run test -- src/lib/i18n/messages.test.ts`
- CV language boundary tests pass: `npm run test -- src/lib/i18n/cv-language-boundary.test.ts`
- Existing CV save/export/generation tests pass: `npm run test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- Scope guard finds no obvious stale English UI strings in migrated surfaces: `rg "\"(Sign in|Start CV|Generate draft|Export PDF|Saved CVs|Questionnaire|Back to workspace|Try again|Delete CV|Workspace status)\"" src`

#### Manual Verification:

- Questionnaire flow renders steps, labels, validation, review, sparse warnings, loading, and retry states in English, Polish, and Russian.
- Generated draft editor renders section UI, edit controls, save/export controls, dialogs, and empty states in the selected UI language.
- Saved CV list and reopened CV view render localized actions and errors while preserving each saved CV's output language label.
- Changing UI language does not change the selected CV output language, generated draft language, saved CV language, or exported CV content language.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Boundary Protection, Tests, And Browser Smoke

### Overview

Harden the implementation with targeted tests, full repo gates, and browser smoke across all three languages. This phase focuses on proving S-09 closes the roadmap slice without pulling in deep localization or route migration.

### Changes Required:

#### 1. Locale Resolver Tests

**File**: `src/lib/i18n/locales.test.ts`

**Intent**: Lock down supported locale parsing and cookie fallback behavior.

**Contract**: Cover valid locales, invalid values, missing values, default fallback, and label availability for all `uiLocales`.

#### 2. Message Coverage Tests

**File**: `src/lib/i18n/messages.test.ts`

**Intent**: Prevent one locale from missing catalog branches or critical labels.

**Contract**: Assert every `UiLocale` has the same top-level message groups and required nested groups for landing, auth, dashboard, questionnaire, editor, library, export, errors, and shell. Avoid snapshotting huge copy blocks; test structure and representative required strings.

#### 3. Auth Error Code Tests

**File**: `src/lib/i18n/auth-errors.test.ts`

**Intent**: Ensure stable auth error codes map to localized display copy.

**Contract**: Cover known signin/signup codes, rate limiting, auth unavailable, and unknown-code fallback for all UI locales.

#### 4. CV Language Boundary Tests

**File**: `src/lib/i18n/cv-language-boundary.test.ts`

**Intent**: Prove interface locale and CV output language stay independent.

**Contract**: Cover output-language label display, saved CV language labels, default title behavior, and PDF/export heading selection according to the final implementation contract.

#### 5. Scope Guard Documentation

**File**: `context/changes/interface-localization/plan.md`

**Intent**: Keep implementation and review focused by documenting search commands that catch route migration, deep localization, and stale English copy.

**Contract**: Include verification commands in the Progress section and manual testing checklist. No separate research artifact is required unless implementation discovers new uncertainty.

#### 6. Browser Smoke Checklist

**File**: `context/changes/interface-localization/plan-brief.md`

**Intent**: Make the final manual smoke path easy to run during implementation closeout.

**Contract**: Summarize the en/pl/ru smoke path: landing, auth page validation, dashboard, new CV questionnaire, review/editor, save, saved CV list, export status/error where feasible, and no URL prefix changes.

### Success Criteria:

#### Automated Verification:

- Astro types regenerate: `npx astro sync`
- Full test suite passes: `npm run test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- No route-prefix i18n migration appears: `rg "prefixDefaultLocale|redirectToDefaultLocale|astro:i18n|\\[lang\\]|\\[locale\\]" astro.config.mjs src`
- No direct `ui_locale` coupling to CV output fields appears: `rg "ui_locale|UI_LOCALE_COOKIE|locale" src/lib/cv-questionnaire.ts src/lib/cv-draft.ts src/lib/services/cv-generation.ts`

#### Manual Verification:

- Browser smoke passes in English, Polish, and Russian for landing, auth, dashboard, questionnaire, draft review/editor, save/reopen, delete dialog, and export controls.
- Switching UI language persists across refresh and navigation while URLs remain unprefixed.
- Major error states reachable without external service changes render localized user-facing copy.
- CV output language and exported/saved content do not change when only the UI language changes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before closing the change.

---

## Testing Strategy

### Unit Tests:

- `src/lib/i18n/locales.test.ts`: supported locale parsing, invalid fallback, cookie name/labels.
- `src/lib/i18n/messages.test.ts`: message coverage parity across `en`, `pl`, and `ru`.
- `src/lib/i18n/auth-errors.test.ts`: stable auth error code mapping and unknown fallback.
- `src/lib/i18n/cv-language-boundary.test.ts`: UI locale independence from CV output/durable/exported content.

### Integration Tests:

- Existing API and CV tests remain the regression net: run `npm run test`.
- Use targeted API/client tests where existing files already cover generation, save, export, and validation behavior.

### Manual Testing Steps:

1. Open `/`, switch UI language to Polish, refresh, and confirm copy plus `<html lang="pl">`.
2. Navigate to `/auth/signin`, submit empty/invalid fields, and confirm localized validation messages.
3. Trigger a failed signin and confirm the stable error code renders localized user-facing copy.
4. Sign in, open `/dashboard`, and confirm workspace and saved-CV library copy is localized.
5. Open `/cv/new`, switch language, and confirm the URL remains `/cv/new` while questionnaire copy changes.
6. Select a CV output language different from UI language, generate a draft, and confirm UI chrome follows UI language while the generated content follows CV output language.
7. Save the CV, reopen it from `/dashboard`, and confirm localized saved-CV actions with unchanged saved CV language.
8. Export PDF and confirm export button/status/error copy follows UI language while exported CV content language follows the CV output contract.

## Performance Considerations

The catalog is static TypeScript data and should add negligible runtime cost. Keep catalog modules zod-free, React-free, and Supabase-free so they remain safe for both server code and client islands. Do not introduce async translation loading, runtime translation services, or per-request database reads.

## Migration Notes

No database migration is planned. Existing saved CVs keep their stored `language`, `draft`, and `sourceSnapshot` unchanged. Existing routes and links remain valid because S-09 does not introduce locale-prefixed paths.

Auth redirect query params change from raw prose to stable codes. During implementation, pages should handle both old prose and new codes defensively if needed, but the final intended contract is stable codes plus localized display.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-09 Interface localization.
- PRD requirement: `context/foundation/prd.md` FR-015 and Interface language support NFR.
- Existing locale seed: `src/lib/landing-content.ts:1`.
- Existing route/auth middleware: `src/middleware.ts:4`.
- Existing copy modules: `src/lib/cv-editor-copy.ts:13`, `src/lib/cv-library-copy.ts:13`, `src/lib/cv-export-copy.ts:13`.
- Largest inline copy surface: `src/components/cv/QuestionnaireFlow.tsx:27`.
- Context7 Astro docs consulted: Astro i18n configuration supports locale lists, route prefix behavior, redirects/fallbacks, and optional `astro:i18n` middleware; S-09 intentionally avoids this route-level migration.

## Scope Guards

Reproducible search commands that keep this change inside its intended scope. Each note records the
known false-positive class so reviewers do not chase legitimate matches.

1. **No route-prefix i18n migration.** S-09 keeps unprefixed routes; no `astro:i18n` adoption.

   ```bash
   rg -n "prefixDefaultLocale|redirectToDefaultLocale|astro:i18n" astro.config.mjs src
   find src/pages -type d \( -name '[lang]' -o -name '[locale]' \)
   ```

   Both must return nothing. Note: the broader guard `rg "...\[lang\]|\[locale\]" src` also matches
   `byLocale[locale]` object-index access (Pattern A copy selectors) — those are expected, not route
   directories. Use the two commands above to read the real signal.

2. **No `ui_locale` coupling into CV output/content fields.** Interface locale must not leak into the
   questionnaire, draft, or generation modules that govern CV output language.

   ```bash
   rg -n "ui_locale|UI_LOCALE_COOKIE|locale" src/lib/cv-questionnaire.ts src/lib/cv-draft.ts src/lib/services/cv-generation.ts
   ```

   Must return nothing (exit 1).

3. **No stale inline English on migrated surfaces.** Components and pages render copy from catalogs,
   not inline strings.

   ```bash
   rg "\"(Sign in|Start CV|Generate draft|Export PDF|Saved CVs|Questionnaire|Back to workspace|Try again|Delete CV|Workspace status)\"" src/components src/pages
   ```

   Must return nothing. Note: the unscoped `... src` form intentionally matches the `en` catalog data
   modules in `src/lib/` — that is the translation source of truth, not stale UI copy. Scope the guard
   to `src/components src/pages` to read migrated render surfaces only.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Locale Contract, Cookie, And Shell Switcher

#### Automated

- [x] 1.1 Astro types regenerate: `npx astro sync` — 441224b
- [x] 1.2 Locale resolver tests pass: `npm run test -- src/lib/i18n/locales.test.ts` — 441224b
- [x] 1.3 Type/lint gate passes for Phase 1 files: `npm run lint` — 441224b
- [x] 1.4 Production build passes: `npm run build` — 441224b

#### Manual

- [x] 1.5 Switching language writes `ui_locale` and stays on the same unprefixed route — 441224b
- [x] 1.6 `<html lang>` changes between `en`, `pl`, and `ru` — 441224b
- [x] 1.7 Existing auth protection for `/dashboard` and `/cv` still redirects signed-out users to `/auth/signin` — 441224b

### Phase 2: Astro Pages, Auth, And Server Error Codes

#### Automated

- [x] 2.1 Auth error code tests pass: `npm run test -- src/lib/i18n/auth-errors.test.ts` — e7626ca
- [x] 2.2 Existing auth pages and API routes lint cleanly: `npm run lint` — e7626ca
- [x] 2.3 Production build passes: `npm run build` — e7626ca
- [x] 2.4 Scope guard finds no raw auth prose in query redirects: `rg "encodeURIComponent\\((AUTH_|SIGNIN_|SIGNUP_|RATE_).*MESSAGE|getSign(In|Up)ErrorMessage" src/pages/api/auth` returns no stale raw-message redirect pattern — e7626ca

#### Manual

- [x] 2.5 Landing, signin, signup, confirm-email, dashboard, `/cv/new`, and `/cv/[id]` headers render in English, Polish, and Russian — e7626ca
- [x] 2.6 Auth form validation messages render in the selected UI language — e7626ca
- [x] 2.7 Failed signin/signup displays localized error copy from a stable error code — e7626ca
- [x] 2.8 Language switcher appears in the global shell/header locations without crowding mobile layouts — e7626ca

### Phase 3: React CV Flow Islands

#### Automated

- [x] 3.1 Catalog coverage tests pass: `npm run test -- src/lib/i18n/messages.test.ts` — 1fbdc63
- [x] 3.2 CV language boundary tests pass: `npm run test -- src/lib/i18n/cv-language-boundary.test.ts` — 1fbdc63
- [x] 3.3 Existing CV save/export/generation tests pass: `npm run test` — 1fbdc63
- [x] 3.4 Lint passes: `npm run lint` — 1fbdc63
- [x] 3.5 Production build passes: `npm run build` — 1fbdc63
- [x] 3.6 Scope guard finds no obvious stale English UI strings in migrated surfaces: `rg "\"(Sign in|Start CV|Generate draft|Export PDF|Saved CVs|Questionnaire|Back to workspace|Try again|Delete CV|Workspace status)\"" src` — 1fbdc63

#### Manual

- [x] 3.7 Questionnaire flow renders steps, labels, validation, review, sparse warnings, loading, and retry states in English, Polish, and Russian — 1fbdc63
- [x] 3.8 Generated draft editor renders section UI, edit controls, save/export controls, dialogs, and empty states in the selected UI language — 1fbdc63
- [x] 3.9 Saved CV list and reopened CV view render localized actions and errors while preserving each saved CV's output language label — 1fbdc63
- [x] 3.10 Changing UI language does not change the selected CV output language, generated draft language, saved CV language, or exported CV content language — 1fbdc63

### Phase 4: Boundary Protection, Tests, And Browser Smoke

#### Automated

- [x] 4.1 Astro types regenerate: `npx astro sync` — 8ba5a64
- [x] 4.2 Full test suite passes: `npm run test` — 8ba5a64
- [x] 4.3 Lint passes: `npm run lint` — 8ba5a64
- [x] 4.4 Production build passes: `npm run build` — 8ba5a64
- [x] 4.5 No route-prefix i18n migration appears: `rg "prefixDefaultLocale|redirectToDefaultLocale|astro:i18n|\\[lang\\]|\\[locale\\]" astro.config.mjs src` — 8ba5a64
- [x] 4.6 No direct `ui_locale` coupling to CV output fields appears: `rg "ui_locale|UI_LOCALE_COOKIE|locale" src/lib/cv-questionnaire.ts src/lib/cv-draft.ts src/lib/services/cv-generation.ts` — 8ba5a64

#### Manual

- [x] 4.7 Browser smoke passes in English, Polish, and Russian for landing, auth, dashboard, questionnaire, draft review/editor, save/reopen, delete dialog, and export controls — 8ba5a64
- [x] 4.8 Switching UI language persists across refresh and navigation while URLs remain unprefixed — 8ba5a64
- [x] 4.9 Major error states reachable without external service changes render localized user-facing copy — 8ba5a64
- [x] 4.10 CV output language and exported/saved content do not change when only the UI language changes — 8ba5a64
