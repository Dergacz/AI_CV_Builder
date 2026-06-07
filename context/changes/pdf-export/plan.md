# PDF Export (S-07) Implementation Plan

## Overview

Add a client-side "Export PDF" action to the reviewed CV so a user can download a clean, readable PDF of the CV they just generated or reopened, and see clear failure states if export fails. Rendering uses a lazily-loaded `@react-pdf/renderer` document that consumes the structured `GeneratedCvDraft` (not arbitrary model HTML), with bundled Noto Sans fonts so English, Polish, and Russian text render correctly. This implements roadmap slice **S-07** (`FR-010`, `FR-014`, `US-01`).

## Current State Analysis

The reviewed CV already exists as structured data and an editable on-screen template; nothing exports it.

- The export target is `GeneratedCvDraft` (`src/lib/cv-draft.ts:74-102`), re-exported via `src/types.ts:8-20`. The live, edited copy at export time is the `draft` prop inside `CvEditor` after `useCvDraftEditor.commitSection` edits are applied (`src/components/hooks/useCvDraftEditor.ts:49-55`).
- `CvEditor.tsx:91-135` holds the "save bar" (title input + Save button + inline status/error). This is where the Export button belongs.
- The `export_failed` error bucket and its English copy already exist, unused, reserved for S-07, in a deliberately **zod-free** module: `src/lib/cv-draft-messages.ts:11-21`. A client island can import it without pulling zod.
- Failure UI convention is an inline, persistent `role="alert"` red banner that keeps the CV on screen (no toast system exists); progress uses a `role="status" aria-live="polite"` region and a custom Tailwind `animate-spin` spinner. Examples: `QuestionnaireFlow.tsx:331-338,501-508`, `CvEditor.tsx:110-114,127-134`.
- `useCvSave.ts:51-79` is the established `idle → saving → saved/error` client state-machine pattern to mirror.

### Key Discoveries:

- **The reuse seam is data, not DOM.** `CvTemplate.tsx:15` says S-07 "reuses this," but `@react-pdf/renderer` uses its own `<Document>/<Page>/<View>/<Text>` primitives — so S-07 is a **parallel renderer over the same `GeneratedCvDraft`**, reusing the five sections + empty-state branches, not the HTML/Tailwind (`src/components/cv/CvTemplate.tsx:17-153`).
- **Fonts are a hard gap.** `public/` holds only `favicon.png`, `.assetsignore`, `template.png` — no fonts anywhere (no `Font.register`/`@font-face`/woff/ttf in repo). react-pdf's default Helvetica has no Cyrillic and limited Latin-Extended, so `pl`/`ru` would render as blank/tofu without a bundled font. Flagged in `pdf-runtime-spike.md:38,46`.
- **Bundle isolation is net-new.** All 5 islands hydrate `client:load`; there is **no `client:only`, `React.lazy`, `Suspense`, or dynamic `import()` anywhere in `src/`**. The heavy browser-only lib must be kept out of the SSR/Worker bundle.
- **Zod-free island boundary is a hard rule** (S-05): islands use `import type { GeneratedCvDraft }` only — never import `generatedCvDraftSchema` into a client island.
- **Test glob excludes `.tsx`** — `vitest.config.ts:13-14` includes `src/**/*.test.ts` only. Pure-logic helpers are the unit-test surface; the PDF render is manual QA per the spike.
- **Stack:** React `^19.2.6`, Astro `^6.3.1`, `@astrojs/cloudflare` `^13.5.0`, Vite pinned `^7.3.2` (`overrides`), `output: "server"`, `wrangler.jsonc` `nodejs_compat`, static assets served from `./dist`. Export is browser-side → needs no env entry and must not run react-pdf's Node APIs in the Worker.

## Desired End State

On the reviewed CV (both the creation flow `/cv/new` and the reopen flow `/cv/[id]`), an "Export PDF" button sits in the save bar. Clicking it builds a PDF from the current edited draft and downloads it with a meaningful filename. EN/PL/RU CVs render with correct glyphs in one clean template. While exporting, the button shows progress and is disabled; on failure the CV stays on screen with an inline banner mapped to `export_failed` (render failure) or `service_unavailable` (font/asset fetch failure) and a retry affordance.

**Verify by:** generate a CV in each of EN/PL/RU, edit a section, click Export PDF, and confirm a correctly-named PDF downloads with all five sections legible and correct diacritics/Cyrillic; reopen a saved CV and export it; simulate a font-fetch failure and confirm the `service_unavailable` banner with the CV still visible. Automated gates (`npm run lint`, `npm run build`, `npm run test`, `npm run format`) pass, and `npm run build` confirms `@react-pdf/renderer` is not present in the server/SSR bundle.

## What We're NOT Doing

- **No server-side export route.** Export is entirely client-side; we add no `/api/cv/export` and no env vars. (F-01 allows browser-only on-demand export with no persistence.)
- **No persisting exported PDFs** — export is on-demand only (`pdf-runtime-spike.md:57`).
- **No multi-template / layout customization** — one template (PRD non-goal).
- **No interface-localization catalog** — that is S-09. Export UI strings are English-only, but centralized in one module so S-09 can localize it. (CV _content_ language already comes from `draft.language`.)
- **No changes to generation, editing, save, or reopen logic** — we only read the existing `draft`.
- **No `.tsx` test infrastructure / jsdom blob shims** — the react-pdf document render is manual QA per the spike; only pure helpers are unit-tested.
- **No new toast/notification system** — reuse the existing inline `role="alert"` / `role="status"` pattern.

## Implementation Approach

Build bottom-up: first the pieces verifiable with no UI (dependency, fonts, copy, pure helpers + unit tests), then the PDF document component and the export action wired into the existing `CvEditor` save bar via a `useCvExport` hook, then cross-language/cross-browser manual hardening.

The heavy lib is loaded only on user intent: the click handler does a dynamic `import("@react-pdf/renderer")` and a dynamic import of the PDF document module, then calls `pdf(<doc/>).toBlob()` and triggers an anchor download. This keeps `@react-pdf/renderer` out of the SSR/Worker bundle (no precedent exists in the repo, so the build output must be checked) and means the bundle cost is paid only when a user exports. Font files live in `public/` (served from `dist/` via the Cloudflare assets binding) and are registered with `Font.register` inside the document module.

## Critical Implementation Details

- **Bundle isolation must be verified, not assumed.** Because there is no dynamic-import precedent in this repo and `@react-pdf/renderer` pulls Node-ish deps, the import must be dynamic _and inside the click handler_ (not a top-level `import`), and `npm run build` output must be inspected to confirm the lib is absent from the server entry. If the SSR build chokes, `vite.ssr.noExternal` or `optimizeDeps.exclude` tuning in `astro.config.mjs` may be needed — there is no precedent today.
- **Font registration timing.** `Font.register` must run before `pdf().toBlob()` resolves; register at module load of the document module (which is itself dynamically imported), using absolute `/fonts/...` URLs served from `public/`. A font fetch failure surfaces as a thrown error during `toBlob()` and must be classified as `service_unavailable`, distinct from a render/layout error (`export_failed`).
- **Filename slug preserves Unicode.** The slug helper lowercases, replaces whitespace/punctuation runs with single hyphens, trims leading/trailing hyphens, and keeps Unicode letters/digits (so a Cyrillic or Polish title stays meaningful); only an empty result falls back to `"cv"`. Append `.pdf`.
- **Zod-free boundary.** The document module and hook are client code: import `GeneratedCvDraft` as `import type` only, and import `export_failed`/`service_unavailable` copy from the zod-free `cv-draft-messages.ts`.

## Phase 1: Foundation — dependency, fonts, copy, and pure helpers

### Overview

Everything that can be verified without UI: add the library, bundle the fonts, centralize the English export copy, and write the two pure helpers with unit tests.

### Changes Required:

#### 1. Add the PDF library

**File**: `package.json`

**Intent**: Add `@react-pdf/renderer` as a dependency so the client island can render PDFs. No script or config changes.

**Contract**: New entry under `dependencies`. Run the install so the lockfile updates; confirm it resolves against the pinned Vite `^7.3.2` override without peer-dependency errors.

#### 2. Bundle EN/PL/RU fonts

**File**: `public/fonts/NotoSans-Regular.ttf`, `public/fonts/NotoSans-Bold.ttf`

**Intent**: Provide a font with full Latin + Latin-Extended (Polish) + Cyrillic (Russian) coverage for the PDF, served as static assets from `dist/` via the Cloudflare assets binding.

**Contract**: Two SIL OFL Noto Sans weight files at stable `/fonts/NotoSans-{Regular,Bold}.ttf` paths. These URLs are referenced by `Font.register` in Phase 2. (OFL license permits redistribution; keep the license text alongside if required.)

#### 3. Centralized English export copy

**File**: `src/lib/cv-export-copy.ts` (new)

**Intent**: Single home for export UI strings (button label, exporting/in-progress label, success/announcement text), mirroring the `cv-editor-copy.ts` / `cv-library-copy.ts` convention so S-09 can localize one module. Zod-free, client-safe.

**Contract**: `export const cvExportCopy = { … } as const` with at least `exportPdf`, `exporting`, and an a11y `exported`/announcement string. Error _messages_ are NOT duplicated here — they come from `generationErrorMessages` (`export_failed`, `service_unavailable`) in `cv-draft-messages.ts`.

#### 4. Filename slug helper

**File**: `src/lib/cv-export-filename.ts` (new)

**Intent**: Derive a meaningful, safe download filename from the CV title, falling back to the draft's full name, then `"cv"`.

**Contract**: `buildCvPdfFilename(input: { title?: string; fullName?: string }): string`. Lowercases, collapses whitespace/punctuation to single hyphens, trims hyphens, preserves Unicode letters/digits, falls back to `"cv"` on empty, returns a name ending in `.pdf`. Pure, no side effects.

#### 5. Export error-classification helper

**File**: `src/lib/cv-export-error.ts` (new)

**Intent**: Map a caught export error to the correct user-facing bucket: font/asset _fetch_ failures → `service_unavailable`; render/layout/other → `export_failed`.

**Contract**: `classifyExportError(error: unknown): "export_failed" | "service_unavailable"` returning a `GenerationErrorBucket` subset. Detection keys off fetch/network signals (e.g. failed font request). Pure function; the caller looks up the message via `generationErrorMessages[bucket]`.

#### 6. Unit tests for helpers

**File**: `src/lib/cv-export-filename.test.ts`, `src/lib/cv-export-error.test.ts` (new)

**Intent**: Lock helper behavior in house style (vitest, `@/` alias, `.test.ts`).

**Contract**: Filename tests cover title-present, title-empty→fullName, both-empty→`cv`, Cyrillic/Polish titles preserved, punctuation/whitespace collapsed, `.pdf` suffix. Error tests cover a fetch/network-shaped error → `service_unavailable` and a generic render error → `export_failed`.

### Success Criteria:

#### Automated Verification:

- Linting/type-checking passes: `npm run lint`
- Unit tests pass: `npm run test`
- Production build passes: `npm run build`
- Formatting clean: `npm run format`

#### Manual Verification:

- `@react-pdf/renderer` appears in `package.json` and installed without peer-dependency errors.
- Both Noto Sans TTF files exist under `public/fonts/` and are reachable at `/fonts/NotoSans-Regular.ttf` and `/fonts/NotoSans-Bold.ttf` in `npm run dev`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: PDF document + export action in CvEditor

### Overview

Build the react-pdf document over the structured draft, the `useCvExport` state machine, and wire an Export button into the save bar with lazy on-click loading and inline status/error UI.

### Changes Required:

#### 1. PDF document component

**File**: `src/components/cv/CvPdfDocument.tsx` (new)

**Intent**: A `@react-pdf/renderer` document that renders one clean template of the `GeneratedCvDraft` — Summary, Experience, Education, Skills, Languages — handling the same empty/sparse-section branches as `CvTemplate.tsx`, and registering the bundled Noto Sans fonts. This module is only ever dynamically imported (never statically) so it stays out of the SSR/Worker bundle.

**Contract**: `export function CvPdfDocument({ draft }: { draft: GeneratedCvDraft }): JSX.Element` using `Document/Page/View/Text/StyleSheet` primitives. `import type { GeneratedCvDraft }` only. `Font.register({ family: "Noto Sans", fonts: [{ src: "/fonts/NotoSans-Regular.ttf" }, { src: "/fonts/NotoSans-Bold.ttf", fontWeight: "bold" }] })` at module scope; base style uses `fontFamily: "Noto Sans"`. Mirror the section order and empty-state text intent of `CvTemplate.tsx:17-153` (reuse `cvEditorCopy` section titles / empty-state strings where they read correctly in print).

#### 2. Export state-machine hook

**File**: `src/components/hooks/useCvExport.ts` (new)

**Intent**: Encapsulate the `idle → exporting → done/error` lifecycle and the lazy-load + blob + download side effect, mirroring `useCvSave`.

**Contract**: `useCvExport()` returns `{ status: "idle"|"exporting"|"done"|"error", error: string|null, export: (draft: GeneratedCvDraft, meta: { title?: string; fullName?: string }) => Promise<void> }`. `export` does: dynamic `import("@react-pdf/renderer")` + dynamic `import("@/components/cv/CvPdfDocument")`, `pdf(<CvPdfDocument draft={draft}/>).toBlob()`, build filename via `buildCvPdfFilename`, trigger anchor download (create object URL, click, revoke). On throw: set `error` from `generationErrorMessages[classifyExportError(err)]`, status `error`. Network-failure path resolves to a bucket too (no unhandled rejection).

#### 3. Export button + states in the save bar

**File**: `src/components/cv/CvEditor.tsx`

**Intent**: Add an "Export PDF" button next to Save in the save bar, wired to `useCvExport`, with the same disabled-while-editing guard (`!canEdit`) and disabled-while-exporting behavior, a `role="status"` progress region with the existing spinner, and a `role="alert"` inline error banner that keeps the CV visible. Button label swaps to the exporting copy; on error it offers retry (re-click).

**Contract**: New button in the `CvEditor.tsx:91-135` action row using `cvExportCopy` labels; `onClick` calls `export(draft, { title: save.title, fullName: draft.sections… /* full name source */ })`. Disabled when `export.status === "exporting" || !canEdit`. Error banner reuses the `border-red-200 bg-red-50 … text-red-900` pattern; progress uses the `animate-spin` spinner + `aria-live="polite"`. No prop/threading changes to `cv/new.astro` or `cv/[id].astro` — both already mount `CvEditor`.

### Success Criteria:

#### Automated Verification:

- Linting/type-checking passes: `npm run lint`
- Unit tests pass: `npm run test`
- Production build passes: `npm run build`
- Formatting clean: `npm run format`
- `@react-pdf/renderer` is absent from the server/SSR bundle (inspect `npm run build` output / `dist` server entry; the lib should appear only in a client chunk loaded on demand).

#### Manual Verification:

- In `/cv/new`, after generating a draft, an "Export PDF" button appears in the save bar; clicking it downloads a PDF containing all five sections legibly in the single template.
- The button is disabled while a section editor is open and while exporting; the label reflects the exporting state.
- Editing a section then exporting reflects the edit in the PDF.
- Reopening a saved CV at `/cv/[id]` and exporting produces the same result.
- Forcing an export error (e.g. block the font request) keeps the CV on screen and shows the inline error banner; retry works.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Cross-language & cross-browser QA hardening

### Overview

Exercise the F-01 spike's remaining validation checklist: language glyph correctness, sparse data, both entry paths, browsers/devices, and the failure split. Primarily manual; fold any defects found back into Phase 1/2 files.

### Changes Required:

#### 1. Language & edge-case fixes (as needed)

**File**: `src/components/cv/CvPdfDocument.tsx` (and helpers, if defects surface)

**Intent**: Resolve any glyph, layout, overflow, or empty-section rendering issues found during QA so EN/PL/RU all produce a clean CV.

**Contract**: Adjust styles/font weights/empty-state handling only; no API or data-shape changes. If a font coverage gap appears for a specific diacritic, fix via the registered font, not by switching architecture.

### Success Criteria:

#### Automated Verification:

- Linting/type-checking passes: `npm run lint`
- Unit tests pass: `npm run test`
- Production build passes: `npm run build`

#### Manual Verification:

- A Polish CV exports with correct diacritics (ł, ń, ż, ś, ą, ę); a Russian CV exports with correct Cyrillic; an English CV is unaffected.
- A sparse draft (empty Experience/Education/Skills/Languages) exports without broken layout, showing the empty-state text.
- Export works on desktop and mobile across modern Chrome, Safari, Firefox, and Edge.
- Render failure → `export_failed` banner; simulated font/asset fetch failure → `service_unavailable` banner; in both the edited CV stays visible with retry.
- Bundle/runtime cost of loading the lib on first export is acceptable (no multi-second hang on a normal connection).

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation. This completes S-07.

---

## Testing Strategy

### Unit Tests:

- `buildCvPdfFilename`: title→slug, fallback chain (title→fullName→`cv`), Unicode (Cyrillic/Polish) preserved, punctuation/whitespace collapse, `.pdf` suffix.
- `classifyExportError`: fetch/network-shaped error → `service_unavailable`; generic render error → `export_failed`.

### Integration Tests:

- None automated (the react-pdf render is browser-only and excluded by the `.test.ts` glob). Covered by manual E2E below.

### Manual Testing Steps:

1. Generate a CV in English, edit the Summary, click Export PDF → correct filename, all sections legible.
2. Repeat for Polish and Russian → verify diacritics and Cyrillic glyphs.
3. Reopen a saved CV (`/cv/[id]`) and export → same result.
4. Export a sparse draft (skip optional sections) → no broken layout, empty-state text present.
5. Block the font request (devtools) and export → `service_unavailable` banner, CV still visible, retry works.
6. Exercise Chrome/Safari/Firefox/Edge on desktop and one mobile browser.

## Performance Considerations

`@react-pdf/renderer` is large; it is loaded only on first Export click via dynamic `import()`, so it never enters the SSR/Worker bundle and costs nothing until used. Fonts (~two TTFs) are fetched on first export and browser-cached thereafter. The export runs synchronously in the browser per the F-01 timeout guidance; if first-export latency is unacceptable on a normal connection, revisit per the spike fallback trigger rather than adding background infrastructure.

## Migration Notes

None — no schema, data, or persistence changes. Purely additive client feature.

## References

- Related research: `context/changes/pdf-export/research.md`
- Decision contract: `context/changes/generation-export-decision-contract/decision-contract.md` (PDF Export Path, Error Buckets, S-07 verification criteria)
- PDF runtime spike: `context/changes/generation-export-decision-contract/pdf-runtime-spike.md`
- Reuse seam (data): `src/components/cv/CvTemplate.tsx:17-153`
- State-machine pattern: `src/components/hooks/useCvSave.ts:51-79`
- Save bar host: `src/components/cv/CvEditor.tsx:91-135`
- Error bucket/copy: `src/lib/cv-draft-messages.ts:11-21`
- Test style: `src/lib/cv-save.test.ts:50-68`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Foundation — dependency, fonts, copy, and pure helpers

#### Automated

- [x] 1.1 Linting/type-checking passes: `npm run lint` — 6df28a1
- [x] 1.2 Unit tests pass: `npm run test` — 6df28a1
- [x] 1.3 Production build passes: `npm run build` — 6df28a1
- [x] 1.4 Formatting clean: `npm run format` — 6df28a1

#### Manual

- [x] 1.5 `@react-pdf/renderer` installed without peer-dependency errors — 6df28a1
- [x] 1.6 Both Noto Sans TTFs reachable at `/fonts/NotoSans-{Regular,Bold}.ttf` — 6df28a1

### Phase 2: PDF document + export action in CvEditor

#### Automated

- [x] 2.1 Linting/type-checking passes: `npm run lint` — edcc847
- [x] 2.2 Unit tests pass: `npm run test` — edcc847
- [x] 2.3 Production build passes: `npm run build` — edcc847
- [x] 2.4 Formatting clean: `npm run format` — edcc847
- [x] 2.5 `@react-pdf/renderer` absent from the server/SSR bundle (client-only chunk) — edcc847

#### Manual

- [x] 2.6 Export button appears in save bar; click downloads a PDF with all five sections legible — edcc847
- [x] 2.7 Button disabled while editing and while exporting; label reflects exporting state — edcc847
- [x] 2.8 Edits are reflected in the exported PDF — edcc847
- [x] 2.9 Reopened saved CV (`/cv/[id]`) exports correctly — edcc847
- [x] 2.10 Forced export error keeps CV visible with inline banner; retry works — b065353

### Phase 3: Cross-language & cross-browser QA hardening

#### Automated

- [x] 3.1 Linting/type-checking passes: `npm run lint` — b065353
- [x] 3.2 Unit tests pass: `npm run test` — b065353
- [x] 3.3 Production build passes: `npm run build` — b065353

#### Manual

- [x] 3.4 Polish diacritics and Russian Cyrillic render correctly; English unaffected — b065353
- [x] 3.5 Sparse draft exports without broken layout (empty-state text shown) — b065353
- [x] 3.6 Works on desktop + mobile across Chrome, Safari, Firefox, Edge — b065353
- [x] 3.7 Render failure → `export_failed`; font/asset fetch failure → `service_unavailable`; CV stays visible in both — b065353
- [x] 3.8 First-export lib load cost acceptable on a normal connection — b065353
