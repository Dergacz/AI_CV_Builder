# Full Saved PDF Flow Smoke Checklist

## Purpose

Record the S-08 north-star proof: a signed-in user creates a CV from scratch, edits it, saves it, reopens it from the dashboard, edits again, exports the current reviewed draft as PDF, and verifies that the selected CV output language survives the joined flow.

Use this file as the execution log. Do not mark items complete from memory; record the browser, UI locale, CV output language, date, and short evidence note when the check is actually run.

## Environment

- Date:
- Commit:
- App URL:
- Test account:
- Notes:

## Representative Matrix

Run one full path in Chrome. Across the full-path run and targeted follow-ups, cover every CV output language at least once and at least two UI/output mismatches.

| Check | Browser / viewport | UI locale | CV output language | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| M1 | Chrome desktop | pl | en | Full path | Pending |
| M2 | Chrome desktop | en | ru | Targeted generation/save/export | Pending |
| M3 | Chrome desktop | ru | pl | Targeted generation/save/export | Pending |
| M4 | Mobile viewport or browser | en | ru | Targeted export/open check | Pending |

## Full Chrome Path

- [ ] Sign in with the test account.
- [ ] Open `/cv/new`.
- [ ] Set UI locale and CV output language according to matrix row M1.
- [ ] Complete the required questionnaire answers with realistic but non-sensitive data.
- [ ] Generate a draft and confirm all five editable sections render: Summary, Experience, Education, Skills, Languages.
- [ ] Edit at least one section before saving.
- [ ] Save the CV and record the saved title, saved language label, and visible save status.
- [ ] Return to `/dashboard` and confirm the saved CV appears with title, localized output-language label, and updated date.
- [ ] Open the saved CV at `/cv/[id]`.
- [ ] Confirm the reopened CV uses the same draft content and does not expose edit-answers or regenerate behavior.
- [ ] Edit a different section and save again.
- [ ] Confirm the second save updates the same CV instead of creating a duplicate dashboard card.
- [ ] Make one additional unsaved edit.
- [ ] Export PDF and confirm the PDF reflects the unsaved on-screen edit.
- [ ] Confirm export status is visually and semantically distinct from save status, so "PDF exported" is not confused with "CV saved".
- [ ] Confirm the exported PDF content follows the CV output language, not the UI locale.

Evidence:

-

## Language Boundary Checks

- [ ] English CV output generated, saved, reopened, and exported at least once.
- [ ] Polish CV output generated, saved, reopened, and exported at least once.
- [ ] Russian CV output generated, saved, reopened, and exported at least once.
- [ ] UI/output mismatch 1 passes: Polish UI with English CV output.
- [ ] UI/output mismatch 2 passes: English UI with Russian CV output.
- [ ] Saved-card language labels are localized display labels keyed by stored `en` / `pl` / `ru` values; the stored output-language value does not mutate when UI locale changes.

Evidence:

-

## Save, Reopen, Delete

- [ ] Saving a new generated CV creates one saved row visible on `/dashboard`.
- [ ] Saving a reopened CV updates the same CV id.
- [ ] Reopening a missing or deleted CV redirects/returns to the dashboard without exposing content.
- [ ] Deleting a saved CV removes it from `/dashboard`.
- [ ] Deleted CV is not reopenable by direct URL.

Evidence:

-

## Major Failure Checks

- [ ] Generation unavailable: user sees a stable failure bucket and retry affordance; no partial saved CV appears.
- [ ] Save failure: edited draft remains visible, save status does not falsely report saved, and retry is possible.
- [ ] Missing/non-owned reopen: no CV content is exposed; user returns to the dashboard or sees the existing safe not-found path.
- [ ] Export failure: edited CV remains visible, localized export error appears, and retry is possible.

Evidence:

-

## Focused Browser / Export Checks

Chrome full path is covered above. Use focused checks for other browsers: open a saved CV, make a small current-draft edit if needed, export, and inspect the PDF.

| Browser / viewport | CV output language | Check | Evidence |
| --- | --- | --- | --- |
| Safari desktop | pl | PDF opens; Polish diacritics readable; current draft exported | Pending |
| Firefox desktop | ru | PDF opens; Cyrillic readable; current draft exported | Pending |
| Edge desktop | en | PDF opens; English text readable; current draft exported | Pending |
| Mobile viewport/browser | ru | Export control reachable; PDF opens or download starts; current draft exported | Pending |

## Bundle Isolation Check

After `npm run build`, inspect the server/SSR output for accidental `@react-pdf/renderer` inclusion outside client assets.

- Command:
- Result:
- [ ] `@react-pdf/renderer` is absent from the server/SSR application bundle.

## Defects And Fix Notes

Use one line per finding. Include the evidence row, observed behavior, fix commit if any, and retest result.

-
