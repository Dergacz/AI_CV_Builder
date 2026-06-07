---
date: 2026-06-06T00:00:00Z
researcher: dergacz
git_commit: b71961de8f0a073debcac92c7475d11e56b955e3
branch: pdf-export
repository: 10-resume
topic: "S-07 PDF export — wiring @react-pdf/renderer into the reviewed-CV flow"
tags: [research, codebase, pdf-export, react-pdf, cloudflare-workers, i18n, error-buckets]
status: complete
last_updated: 2026-06-06
last_updated_by: dergacz
---

# Research: S-07 PDF export — wiring @react-pdf/renderer into the reviewed-CV flow

**Date**: 2026-06-06T00:00:00Z
**Researcher**: dergacz
**Git Commit**: b71961de8f0a073debcac92c7475d11e56b955e3
**Branch**: pdf-export
**Repository**: 10-resume

## Research Question

For roadmap slice **S-07 (`pdf-export`)** — "user can export the reviewed CV as a clean, readable PDF and see clear export failure states" — what does the existing codebase already provide, and what are the concrete integration points and constraints for adding browser-side **@react-pdf/renderer** export? Two pre-locked decisions framed the research:

1. **PDF approach** = `@react-pdf/renderer`, browser-side (per the F-01 `pdf-runtime-spike.md` recommendation).
2. **i18n scope** = find the current string-handling pattern first, then decide whether export strings go into a catalog or stay English-only.

## Summary

- **The reusable contract is data, not DOM.** S-05 built `CvTemplate.tsx` over the structured `GeneratedCvDraft` and explicitly named S-07 as its consumer — but `@react-pdf/renderer` uses its own `<Document>/<Page>/<View>/<Text>` primitives, so S-07 is a **parallel renderer over the same `GeneratedCvDraft` shape**, not a reuse of the HTML/Tailwind template. The reuse point is the type + the five section/empty-state branches.
- **The error bucket is already built and waiting.** `export_failed` is pre-defined in `src/lib/cv-draft-messages.ts` with finished English copy ("We couldn't export your CV. Your edits are safe — please try again."), reserved for S-07, in a deliberately zod-free module a client island can import.
- **No localization catalog exists yet.** All UI copy is centralized but English-only. `CvOutputLanguage` (per-CV content language) is wired to generation, **not** to UI strings. Recommendation: follow the established convention — add a centralized English-only copy module for export strings — so S-09 can localize one module later. Do **not** build a catalog now.
- **Three genuinely net-new patterns for this codebase**, all driven by `@react-pdf/renderer` being browser-only and heavy: (1) keeping the lib out of the SSR/Worker bundle (no `client:only` / dynamic-import precedent exists), (2) **bundling fonts** with Cyrillic + Latin-Extended glyphs (none in `public/` today — pl/ru would render as tofu without them), (3) lazy-loading a large client dependency.
- **Plan/gate conventions are fixed** by S-05/S-06: phased plan, per-phase manual-confirm pause, automated gates = `npm run lint` (type-checked) + `npm run build` + `npm run test` (vitest) + `npm run format`, `.test.ts` colocated, `## Progress` checklist with commit SHAs.

## Detailed Findings

### Area 1 — The reviewed-CV data shape and template (S-05 reuse point)

- `GeneratedCvDraft` and all section types are defined as zod schemas with inferred types in **`src/lib/cv-draft.ts:74-102`**, re-exported through `src/types.ts:8-20`. Section shapes:
  - `SummarySection`: `{ headline?: string; body: string }` (`cv-draft.ts:19-22`)
  - `ExperienceItem`: `{ role?, organization?, location?, startDate?, endDate?, isCurrent?, description: string, highlights: string[] }` (`:24-33`)
  - `EducationItem`: all-optional `{ institution?, program?, location?, startDate?, endDate?, description? }` (`:35-42`)
  - `SkillGroup`: `{ label: string, items: string[] }` (min 1 item) (`:44-48`)
  - `LanguageItem`: `{ name: string, proficiency?: string }` (`:50-53`)
  - Top level also carries `language: "en"|"pl"|"ru"`, `source`, `assumptions`, `warnings` (`:74-92`).
- The current template component is **`src/components/cv/CvTemplate.tsx`** — signature `CvTemplate({ draft }: { draft: GeneratedCvDraft })` (`:17-39`), mapping each of the five sections to per-section render functions (`SummaryContent` `:41-48`, `ExperienceContent` `:50-76`, `EducationContent` `:78-99`, `SkillsContent` `:101-114`, `LanguagesContent` `:116-130`), with `DraftSection` wrapper (`:139-149`) and `EmptyNote` empty-state (`:151-153`). Its docstring (`:15`) says _"S-07 PDF export reuses this whole component"_ — **interpret as reuse of the data contract and the section/empty-state logic, not the HTML.**
- Edited-draft state flow (the "what to export" object):
  - Creation path: `draft` state lives in `QuestionnaireFlow.tsx` (state ~`:75`), passed to `CvEditor` (~`:158`).
  - Reopen path: `SavedCvView.tsx` takes server-loaded `draft` prop, wraps in `useState` (~`:28`), passes to `CvEditor`.
  - Edits are applied immutably via `useCvDraftEditor.commitSection` (`src/components/hooks/useCvDraftEditor.ts:49-55`); `CvSectionKey = "summary"|"experience"|"education"|"skills"|"languages"`.
  - At export time, the live object is the `draft` prop inside `CvEditor`, after all `commitSection` edits.
- Pages/islands: `src/pages/cv/new.astro:22` mounts `<QuestionnaireFlow client:load />`; `src/pages/cv/[id].astro:51` mounts `<SavedCvView client:load … draft={cv.draft} />`. Both converge on **`src/components/cv/CvEditor.tsx`** — the natural host for an Export action.
- **No PDF dependency or `@react-pdf` reference exists anywhere** (package.json + src). Net-new.

### Area 2 — Error buckets, failure-state UI, API conventions

- **`export_failed` already exists, unused, reserved for S-07** — `src/lib/cv-draft-messages.ts:11-21`:
  ```ts
  export type GenerationErrorBucket = "generation_failed" | "export_failed" | "service_unavailable";
  export const generationErrorMessages: Record<GenerationErrorBucket, string> = {
    generation_failed: "We couldn't build your CV draft from these answers. Please try again.",
    export_failed: "We couldn't export your CV. Your edits are safe — please try again.",
    service_unavailable: "CV generation is temporarily unavailable. Please try again in a little while.",
  };
  ```
  Module is **zod-free on purpose** so client islands can import copy without pulling zod. Re-exported via `cv-draft.ts:3-6`.
- **Failure-state UI is inline, not toast.** The app has **no toast/sonner system**. Established pattern (mirror it): `role="alert"` red banner (`border-red-200 bg-red-50 … text-red-900`) that **stays visible** and keeps the CV on screen, plus a `role="status" aria-live="polite"` region for progress. Examples: generation error `QuestionnaireFlow.tsx:331-338`; save error `CvEditor.tsx:127-134`; save "Saved" status `CvEditor.tsx:110-114`.
- **Loading/disabled pattern**: custom Tailwind `animate-spin` border spinner (no library) — `QuestionnaireFlow.tsx:501-508`, `auth/SubmitButton.tsx:21-23`. Buttons swap label by state and use `disabled:cursor-not-allowed disabled:bg-slate-300`. Save button is also disabled while a section editor is open (`!canEdit`, `CvEditor.tsx:120`) — Export should do the same.
- **Save bar is the home for the Export button** — `CvEditor.tsx:91-135` (flex row: title input left; status + Save button right). Export sits next to Save.
- **API route conventions** (`src/pages/api/cv/generate.ts` as the model): `export const prerender = false`; auth guard returns `service_unavailable`/401; `content-length` cap (`MAX_REQUEST_BODY_BYTES = 40_000`) → 413; `try/catch` JSON parse → 400; zod `safeParse` → 400; missing dependency → 503; discriminated-union response `{ ok: true; … } | { ok: false; error: <bucket>; message: string }`; status mapped from bucket (`service_unavailable`→503, else 422). No stack traces/secret names in messages.
- **Client hook pattern**: `useCvSave.ts:51-79` is the state-machine template (`idle → saving → saved/error`, network-failure fallback to `service_unavailable`). An export controller should mirror it.

### Area 3 — i18n / string-handling (decision input)

- **No en/pl/ru UI catalog or locale switching exists today.** `landingContentByLocale` (`src/lib/landing-content.ts:44-105`) is _typed_ for `en|pl|ru` but only `en` is populated; `landingContent = landingContentByLocale.en`. No language switcher, no locale routing, no persistence. S-09 is `ready`, not `done`.
- **Established convention = centralized, English-only copy modules**, each documented as "one module per locale for S-09 to wrap later":
  - `src/lib/cv-editor-copy.ts:13-100` (`cvEditorCopy`), `src/lib/cv-library-copy.ts:13-48` (`cvLibraryCopy`), `src/lib/cv-draft-messages.ts`, `src/lib/cv-save-messages.ts`. All flat `as const` objects, zod-free, client-safe.
- **`CvOutputLanguage` is content-only, not UI.** Defined `src/lib/cv-questionnaire.ts:3-5`; flows into `/api/cv/generate` and ends up as `draft.language`. UI labels for it are separate hardcoded maps (`QuestionnaireFlow.tsx:60-64`, `SavedCvList.tsx:17-21`). It does **not** drive UI-chrome language.
- **Decision (resolved):** keep export UI strings **English-only now**, but place them in a **new centralized module** (e.g. `src/lib/cv-export-copy.ts` for labels like "Export PDF" / "Exporting…", reuse `export_failed` from `cv-draft-messages.ts` for the error). This matches the house convention and leaves S-09 a single module to localize — without building catalog infrastructure that S-09 owns.

### Area 4 — Stack constraints for @react-pdf/renderer (net-new patterns)

- **Versions** (`package.json`): React `^19.2.6`, Astro `^6.3.1`, `@astrojs/cloudflare` `^13.5.0`, `@astrojs/react` `^5.0.4`, Tailwind `^4.2.4`, Zod `^4.4.3` (v4), vitest `^4.1.8`, wrangler `^4.90.0`, TypeScript `^5.9.3`. `overrides: { vite: "^7.3.2" }` (Vite 7 pinned — check `@react-pdf/renderer` bundler/peer compat against it).
- **Runtime/config**: `astro.config.mjs` → `output: "server"`, `adapter: cloudflare()` (no custom options), env via `astro:env/server` (all optional secrets). `wrangler.jsonc` → `compatibility_flags: ["nodejs_compat"]`, static assets served from `./dist`. **PDF export is browser-side → needs no env entry and must not run react-pdf's Node APIs (`renderToBuffer/Stream/File`) in the Worker** (F-01 spike rule).
- **Bundle isolation is net-new.** All 5 islands hydrate with `client:load`; there is **no `client:only`, `client:visible`, `React.lazy`, `Suspense`, or dynamic `import()` anywhere in `src/`.** `@react-pdf/renderer` is large and browser-only, so S-07 likely needs `client:only="react"` and/or a lazy `import()` to keep it out of the SSR/Worker bundle, and possibly `vite.ssr.noExternal` tuning (none configured today).
- **Fonts are a hard gap.** `public/` holds only `favicon.png`, `.assetsignore`, `template.png` — **no fonts**, no `Font.register`/`@font-face`/woff/ttf anywhere. react-pdf's default Helvetica has **no Cyrillic and limited Latin-Extended**, so `pl`/`ru` export would be blank/tofu. S-07 must add a Cyrillic+Latin-Extended font to `public/`, serve from `dist/` via the assets binding, and `Font.register(...)` it. (Flagged in `pdf-runtime-spike.md:38,46`.) `template.png` is an unreferenced mockup.
- **Zod-free island boundary is a hard rule** (S-05): islands use `import type { GeneratedCvDraft }` only — never import `generatedCvDraftSchema` into a client island. The PDF document component is a client island and must obey this.

### Area 5 — Plan & test conventions to mirror (S-05, S-06)

- Plan skeleton (both prior plans): `Overview → Current State Analysis (### Key Discoveries with file:line) → Desired End State (with "Verify by:") → What We're NOT Doing → Implementation Approach → Critical Implementation Details → Phase N blocks → Testing Strategy → Performance → Migration Notes → References → Progress`.
- Phases are independently verifiable, built bottom-up; each phase has `### Changes Required` (File/Intent/Contract triplets) + `### Success Criteria` split into `#### Automated Verification` / `#### Manual Verification`, and ends with a manual-confirm pause.
- **Gates**: `npm run lint` (ESLint is type-checked here → lint _is_ typecheck), `npm run build`, `npm run test` (`vitest run`), `npm run format`.
- **Tests**: vitest `describe/it/expect`, `@/` alias, colocated `*.test.ts`. **`vitest.config.ts` include glob is `src/**/\*.test.ts`only (not`.tsx`)** — pure-logic helpers (filename builder, font-by-language selection, error mapping) are the unit-test surface; the PDF render itself is manual QA per the spike checklist. House example: `src/lib/cv-save.test.ts:50-68` (loads the F-01 fixture, accept/reject pairs).
- `## Progress` mirrors every success criterion as `- [x] … — <commit sha>` checkboxes.

## Code References

- `src/lib/cv-draft.ts:74-102` — `GeneratedCvDraft` + section schemas/types (export input)
- `src/components/cv/CvTemplate.tsx:15,17-39,41-153` — current template; section + empty-state logic to mirror in the PDF document
- `src/components/cv/CvEditor.tsx:91-135` — save bar (Export button host), error banner + status patterns
- `src/components/hooks/useCvSave.ts:51-79` — state-machine pattern for an export controller
- `src/components/hooks/useCvDraftEditor.ts:49-55` — how the live edited draft is assembled
- `src/lib/cv-draft-messages.ts:11-21` — `export_failed` bucket + copy (already built, zod-free)
- `src/pages/api/cv/generate.ts` — API route conventions (prerender=false, zod, content-length cap, bucket→status)
- `src/lib/cv-editor-copy.ts:1-100`, `src/lib/cv-library-copy.ts:13-48` — centralized English-only copy convention
- `src/lib/cv-questionnaire.ts:3-5` — `CvOutputLanguage` (content-only)
- `src/pages/cv/new.astro:22`, `src/pages/cv/[id].astro:51` — island mount points (`client:load`)
- `astro.config.mjs` (output/adapter/env), `wrangler.jsonc` (nodejs_compat, assets from `./dist`), `vitest.config.ts:13-14` (`.test.ts`-only glob)
- `public/` — only `favicon.png`, `.assetsignore`, `template.png`; **no fonts**
- `src/lib/cv-save.test.ts:50-68` — house test style

## Architecture Insights

- **The structured-draft contract is the durable seam.** Every slice (generate → edit → save → export) passes the same `GeneratedCvDraft`. S-07 adds a third _renderer_ of that contract (HTML template, persisted JSON, now PDF) rather than transforming data.
- **Inline, persistent failure UI is a deliberate house style** (no toasts; `role="alert"` stays visible; CV never disappears on error). This directly satisfies the F-01 rule "keep the edited CV visible if export fails."
- **Copy is centralized precisely to make S-09 cheap.** Adding an English-only `cv-export-copy.ts` is the convention-following move; building locale switching is out of scope (S-09 owns it).
- **The real engineering risk is bundle + fonts, not Workers compatibility.** Because rendering is client-side, the open problems are (1) preventing the heavy lib from entering the SSR/Worker bundle and (2) shipping fonts that cover en/pl/ru — both net-new for this repo.

## Historical Context (from prior changes)

- `context/changes/generation-export-decision-contract/decision-contract.md` — F-01: export must consume the structured draft (not model HTML), map failures to `export_failed`/`service_unavailable`, keep the edited CV visible, offer retry; PDF path must be Workers/browser-compatible (no Node-only APIs, Chromium, fs).
- `context/changes/generation-export-decision-contract/pdf-runtime-spike.md` — recommends browser-side `@react-pdf/renderer` (`PDFDownloadLink`/`BlobProvider`); lists remaining S-07 validation incl. **en/pl/ru font rendering**, modern-browser QA, bundle cost; fallback to external service only if browser path fails quality/fonts/browser support.
- `context/changes/generation-export-decision-contract/cv-contract.fixture.json` — known-good draft for tests.
- `context/changes/cv-template-section-editing/plan.md` (S-05) — built `CvTemplate` as the S-07 reuse point; zod-free island boundary rule; schema-agreement test pattern.
- `context/changes/saved-cv-library/plan.md` (S-06) — separate dedicated copy/messages module pattern (`cv-save-messages.ts`); phased-plan + gate + `## Progress` conventions.

## Related Research

- None prior for this change. This is the first `research.md` under `context/changes/pdf-export/`.

## Open Questions

1. **Font choice & licensing** — which single TTF/WOFF covers Latin + Latin-Extended (Polish) + Cyrillic (Russian) at acceptable size? (Candidates to weigh in planning: Noto Sans, DejaVu Sans, Roboto.) Bundle-size impact of subsetting.
2. **Render trigger** — `PDFDownloadLink` (declarative, pre-renders blob on mount → cost on every editor render) vs. `pdf(<Doc/>).toBlob()` on click (lazy, fits the existing on-click state machine better). Lean on-click to match `useCvSave` and to gate the heavy lib behind user intent.
3. **Island strategy** — dedicated `client:only="react"` export island vs. lazy `import()` inside `CvEditor`. Must verify the lib stays out of the SSR/Worker bundle in `npm run build`.
4. **Filename** — derive from CV title / full name + language; needs a small pure helper (unit-testable).
5. **No server route?** — F-01 allows browser-only export with no persistence; confirm the plan adds **no** `/api/cv/export` route (export stays client-side), so "export error" is a client render/blob failure mapped to `export_failed`, with `service_unavailable` reserved for font/asset fetch failures.
