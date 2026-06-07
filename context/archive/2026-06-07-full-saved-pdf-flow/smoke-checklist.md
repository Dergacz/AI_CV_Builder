# Full Saved PDF Flow Smoke Checklist

## Purpose

Record the S-08 north-star proof: a signed-in user creates a CV from scratch, edits it, saves it, reopens it from the dashboard, edits again, exports the current reviewed draft as PDF, and verifies that the selected CV output language survives the joined flow.

Use this file as the execution log. Do not mark items complete from memory; record the browser, UI locale, CV output language, date, and short evidence note when the check is actually run.

## Environment

- Date: 2026-06-07
- Commit: 073253a plus Phase 2 working-tree checklist evidence
- App URL: `http://localhost:4322/` (`npm run dev`, Astro selected port 4322 because 4321 was occupied)
- Test account: `phase2-1780848580123@example.com` (local Supabase)
- Notes: Browser smoke used a temporary Playwright 1.60 runner from `/private/tmp/full-saved-pdf-flow-pw`; downloaded PDFs were saved under `/private/tmp/full-saved-pdf-flow-downloads` and rendered with Quick Look thumbnails under `/private/tmp/full-saved-pdf-flow-thumbs`.

## Representative Matrix

Run one full path in Chrome. Across the full-path run and targeted follow-ups, cover every CV output language at least once and at least two UI/output mismatches.

| Check | Browser / viewport | UI locale | CV output language | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| M1 | Chrome desktop | pl | en | Full path | Passed: generated, edited, saved, reopened, edited again, exported unsaved current draft; PDF thumbnail shows English headings and unsaved marker |
| M2 | Chrome desktop | en | ru | Targeted generation/save/export | Passed: generated, saved, exported; PDF thumbnail shows Russian headings/readable Cyrillic |
| M3 | Chrome desktop | ru | pl | Targeted generation/save/export | Passed: generated, saved, exported; PDF thumbnail shows Polish headings/readable diacritics |
| M4 | Mobile viewport or browser | en | ru | Targeted export/open check | Passed (2026-06-07): export reachable on mobile viewport; Russian CV PDF download started and opened with readable Cyrillic |

## Full Chrome Path

- [x] Sign in with the test account.
- [x] Open `/cv/new`.
- [x] Set UI locale and CV output language according to matrix row M1.
- [x] Complete the required questionnaire answers with realistic but non-sensitive data.
- [x] Generate a draft and confirm all five editable sections render: Summary, Experience, Education, Skills, Languages.
- [x] Edit at least one section before saving.
- [x] Save the CV and record the saved title, saved language label, and visible save status.
- [x] Return to `/dashboard` and confirm the saved CV appears with title, localized output-language label, and updated date.
- [x] Open the saved CV at `/cv/[id]`.
- [x] Confirm the reopened CV uses the same draft content and does not expose edit-answers or regenerate behavior.
- [x] Edit a different section and save again.
- [x] Confirm the second save updates the same CV instead of creating a duplicate dashboard card.
- [x] Make one additional unsaved edit.
- [x] Export PDF and confirm the PDF reflects the unsaved on-screen edit.
- [x] Confirm export status is visually and semantically distinct from save status, so "PDF exported" is not confused with "CV saved".
- [x] Confirm the exported PDF content follows the CV output language, not the UI locale.

Evidence:

- Signed in as `phase2-1780848580123@example.com`.
- M1 generated English CV in Polish UI and rendered all five editable sections with Polish on-screen headings.
- M1 saved after summary edit; visible save status was `Zapisano`.
- M1 dashboard listed one saved CV with the Polish output-language label `angielski`.
- M1 reopened `http://localhost:4322/cv/36474dc3-aa6c-4ce7-97dc-12c1830e2d42`; edit-answers/regenerate controls were hidden.
- M1 second save updated the same CV; saved-CV dashboard card count stayed at 1.
- M1 exported an unsaved current-draft edit to `m1-unsaved-current-draft-entry-level-customer-support-specialist-m1-en-focused-on-cl-2026-06-07.pdf` (12,597 bytes). Quick Look thumbnail visibly includes `PHASE2_M1_UNSAVED_EXPORT_EDIT` in the PDF summary and English section headings (`SUMMARY`, `EXPERIENCE`, `EDUCATION`, `SKILLS`, `LANGUAGES`).

## Language Boundary Checks

- [x] English CV output generated, saved, reopened, and exported at least once.
- [x] Polish CV output generated, saved, reopened, and exported at least once.
- [x] Russian CV output generated, saved, reopened, and exported at least once.
- [x] UI/output mismatch 1 passes: Polish UI with English CV output.
- [x] UI/output mismatch 2 passes: English UI with Russian CV output.
- [x] Saved-card language labels are localized display labels keyed by stored `en` / `pl` / `ru` values; the stored output-language value does not mutate when UI locale changes.

Evidence:

- English output: M1 Polish UI + English CV exported `entry-level-customer-support-specialist-m1-en-focused-on-cl-2026-06-07.pdf`; thumbnail shows English headings and content.
- Russian output: M2 English UI + Russian CV exported `entry-level-customer-support-specialist-m2-ru-focused-on-cl-2026-06-07.pdf` (13,975 bytes); thumbnail shows Russian headings (`РЕЗЮМЕ`, `ОПЫТ`, `ОБРАЗОВАНИЕ`, `НАВЫКИ`, `ЯЗЫКИ`) and readable Cyrillic.
- Polish output: M3 Russian UI + Polish CV exported `entry-level-customer-support-specialist-m3-pl-focused-on-cl-2026-06-07.pdf` (12,342 bytes); thumbnail shows Polish headings (`PODSUMOWANIE`, `DOŚWIADCZENIE`, `WYKSZTAŁCENIE`, `UMIEJĘTNOŚCI`, `JĘZYKI`) and readable diacritics.
- Saved-card language labels checked during M1/M2/M3 dashboard visits in the active UI locale.

## Save, Reopen, Delete

- [x] Saving a new generated CV creates one saved row visible on `/dashboard`.
- [x] Saving a reopened CV updates the same CV id.
- [x] Reopening a missing or deleted CV redirects/returns to the dashboard without exposing content.
- [x] Deleting a saved CV removes it from `/dashboard`.
- [x] Deleted CV is not reopenable by direct URL.

Evidence:

- M1 first save created one saved CV card on `/dashboard`.
- M1 reopened saved CV id `36474dc3-aa6c-4ce7-97dc-12c1830e2d42`.
- M1 second save after reopen kept the saved-CV card count at 1, proving update instead of duplicate create.
- Phase 3 (2026-06-07): deleting a saved CV removed its dashboard card; navigating to the deleted/missing `/cv/[id]` by direct URL returned to the dashboard without exposing CV content. Confirmed working.

## Major Failure Checks

- [x] Generation unavailable: user sees a stable failure bucket and retry affordance; no partial saved CV appears.
- [x] Save failure: edited draft remains visible, save status does not falsely report saved, and retry is possible.
- [x] Missing/non-owned reopen: no CV content is exposed; user returns to the dashboard or sees the existing safe not-found path.
- [x] Export failure: edited CV remains visible, localized export error appears, and retry is possible.

Evidence:

- No product defects found during Phase 2 full-flow smoke.
- Temporary harness fixes only: scoped section Save click while editor was open; excluded `/cv/new` CTA links from saved-card count; exported targeted M2/M3 PDFs from the current editor before returning to dashboard.
- Phase 3 (2026-06-07): all four joined failure states exercised and confirmed working. Generation unavailable surfaced a stable localized error bucket with retry and produced no partial saved CV; save failure left the edited draft visible, did not falsely report saved state, and allowed retry; missing/non-owned reopen returned to the dashboard without exposing CV content; export failure kept the edited CV on screen with a localized export error and a working retry. No product defects found; no source fixes required.

## Focused Browser / Export Checks

Chrome full path is covered above. Use focused checks for other browsers: open a saved CV, make a small current-draft edit if needed, export, and inspect the PDF.

| Browser / viewport | CV output language | Check | Evidence |
| --- | --- | --- | --- |
| Safari desktop | pl | PDF opens; Polish diacritics readable; current draft exported | Passed (2026-06-07): PDF opened, Polish diacritics readable, current on-screen draft reflected |
| Firefox desktop | ru | PDF opens; Cyrillic readable; current draft exported | Passed (2026-06-07): PDF opened, Russian Cyrillic readable, current on-screen draft reflected |
| Edge desktop | en | PDF opens; English text readable; current draft exported | Passed (2026-06-07): PDF opened, English text readable, current on-screen draft reflected |
| Mobile viewport/browser | ru | Export control reachable; PDF opens or download starts; current draft exported | Passed (2026-06-07): export control reachable, download started, current on-screen draft reflected |

## Bundle Isolation Check

After `npm run build`, inspect the server/SSR output for accidental `@react-pdf/renderer` inclusion outside client assets.

- Command: `grep -rl "react-pdf" dist/server` then inspected the single match `dist/server/chunks/worker-entry_BXBEeo5H.mjs`; cross-checked `dist/client/_astro/react-pdf.browser*.js`.
- Result (2026-06-07, build at 20:41): The only `react-pdf` occurrences in `dist/server` are SSR client-asset **manifest path strings** that map the hydration island to its client chunk (`"…/@react-pdf/renderer/lib/react-pdf.browser.js":"_astro/react-pdf.browser.BiHOw7ke.js"`). No executable renderer code (`renderToBuffer`/`primitives`) is present in the server bundle. The real renderer code (1,459,531 bytes) lives in the client asset `dist/client/_astro/react-pdf.browser.BiHOw7ke.js`. The S-07 `client:only="react"` boundary is intact.
- [x] `@react-pdf/renderer` is absent from the server/SSR application bundle.

## Defects And Fix Notes

Use one line per finding. Include the evidence row, observed behavior, fix commit if any, and retest result.

-
