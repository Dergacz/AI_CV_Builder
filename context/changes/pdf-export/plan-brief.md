# PDF Export (S-07) — Plan Brief

> Full plan: `context/changes/pdf-export/plan.md`
> Research: `context/changes/pdf-export/research.md`

## What & Why

Let a user download a clean, readable PDF of the CV they generated or reopened, and see clear failure states if export fails (roadmap S-07; FR-010, FR-014, US-01). This is the last "generation → export" piece and, with S-09, unblocks the north-star full-flow slice (S-08).

## Starting Point

The reviewed CV already exists as structured `GeneratedCvDraft` data and an editable on-screen template (`CvTemplate`/`CvEditor`), but nothing exports it. The `export_failed` error bucket and its copy are already defined and reserved for S-07; no PDF library or fonts exist in the repo yet.

## Desired End State

An "Export PDF" button in the CV save bar (on both `/cv/new` and `/cv/[id]`) downloads a correctly-named PDF of the live edited draft, with all five sections legible in one template and correct EN/PL/RU glyphs. While exporting, the button is disabled and shows progress; on failure the CV stays on screen with an inline banner and retry.

## Key Decisions Made

| Decision          | Choice                                                        | Why (1 sentence)                                                                            | Source   |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| PDF approach      | `@react-pdf/renderer`, browser-side                           | F-01 spike's recommended Workers-compatible path; consumes structured draft, not model HTML | Research |
| i18n scope        | English-only, new centralized `cv-export-copy.ts`             | Matches house copy-module convention; S-09 owns localization                                | Research |
| Error bucket      | Reuse pre-built `export_failed`                               | Already defined, unused, zod-free for client import                                         | Research |
| Render trigger    | `pdf().toBlob()` on click                                     | Runs heavy lib only on intent; fits the existing `useCvSave` state machine                  | Plan     |
| Bundle isolation  | Lazy `import()` inside `CvEditor`                             | Keeps lib out of SSR/Worker bundle; no new island/prop wiring                               | Plan     |
| Fonts             | Noto Sans Regular+Bold in `public/`                           | Full Latin-Extended (Polish) + Cyrillic (Russian) coverage; OFL licensed                    | Plan     |
| Error granularity | `export_failed` (render) + `service_unavailable` (font fetch) | Honest about what failed; matches F-01's two relevant buckets                               | Plan     |
| Filename          | CV title → slug, fallback full name → `cv`; Unicode preserved | Predictable, meaningful, unit-testable; keeps Cyrillic/Polish titles                        | Plan     |
| Test scope        | Pure helpers only (filename, error-classify)                  | `.test.ts` glob excludes `.tsx`; render is manual QA per spike                              | Plan     |

## Scope

**In scope:** Export button + state machine in `CvEditor`; react-pdf document over the five sections; bundled Noto Sans fonts; English export copy module; filename + error-classification helpers with unit tests; EN/PL/RU + cross-browser manual QA.

**Out of scope:** Any server route / env var; persisting PDFs; multiple templates; localization catalog (S-09); changes to generation/edit/save/reopen; `.tsx` test infra; new toast system.

## Architecture / Approach

Purely additive client feature. The Export button in the `CvEditor` save bar calls a `useCvExport` hook that, on click, dynamically imports `@react-pdf/renderer` + a `CvPdfDocument` module, runs `pdf(<doc/>).toBlob()`, and triggers an anchor download. `CvPdfDocument` renders the structured draft with react-pdf primitives and `Font.register`s Noto Sans served from `public/` → `dist/` via the Cloudflare assets binding. The dynamic import keeps the heavy lib out of the SSR/Worker bundle; failures are caught and mapped to `export_failed` / `service_unavailable`, shown inline with the CV still on screen.

## Phases at a Glance

| Phase                | What it delivers                                                                        | Key risk                                                    |
| -------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Foundation        | Dependency, Noto Sans fonts, `cv-export-copy.ts`, filename + error helpers + unit tests | Font licensing/coverage; install vs pinned Vite 7           |
| 2. Document + action | `CvPdfDocument`, `useCvExport`, Export button + states; lazy load                       | Keeping lib out of SSR bundle (no dynamic-import precedent) |
| 3. QA hardening      | EN/PL/RU glyphs, sparse data, cross-browser, failure split                              | Diacritic/Cyrillic glyph gaps; mobile/browser quirks        |

**Prerequisites:** F-01 (done), S-05 (done) — both met; on branch `pdf-export`.
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- `@react-pdf/renderer` must dynamic-import cleanly under Astro+Cloudflare with pinned Vite 7; if the SSR build pulls it in, may need `vite.ssr.noExternal`/`optimizeDeps` tuning (no precedent in repo) — verified in Phase 2 via build output.
- Noto Sans must cover every required Polish diacritic and Russian glyph at acceptable file size; validated in Phase 3.
- First-export latency from loading the lib must be acceptable on a normal connection, else revisit per the spike fallback trigger.

## Success Criteria (Summary)

- A user can export a clean, legible PDF of their CV in English, Polish, or Russian from both the creation and reopen flows.
- Export failures keep the edited CV visible with a clear, retryable message (`export_failed` / `service_unavailable`).
- The heavy PDF library never ships in the SSR/Worker bundle and loads only on first export.
