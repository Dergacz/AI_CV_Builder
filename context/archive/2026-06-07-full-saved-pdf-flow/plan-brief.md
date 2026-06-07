# Full Saved PDF Flow - Plan Brief

> Full plan: `context/changes/full-saved-pdf-flow/plan.md`

## What & Why

This plan closes S-08, the north-star MVP proof: a signed-in user can start with simple answers, generate a CV, edit it, save it, reopen it, and export a PDF. The goal is to prove the already-built slices work together in English, Polish, and Russian without expanding into new CV-editor or localization features.

## Starting Point

All prerequisite slices are implemented. Creation and reopen paths already converge on `CvEditor`, with save and export hooks wired into the same reviewed CV surface.

## Desired End State

The repo has a deterministic S-08 contract test, an executed smoke checklist, and any targeted integration defects fixed. The manual proof covers the full Chrome path, representative mixed UI/output language combinations, major joined failures, and focused browser/export checks. Closure updates the change folder, roadmap, and Linear after repo gates pass.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Scope | Integration proof + targeted fixes | S-08 should close the north-star flow without reopening feature work. |
| Language matrix | Representative mixed matrix | It proves UI/output independence without a slow 3x3 matrix. |
| Automated coverage | One contract-test layer | Cheap invariant tests catch drift without adding browser e2e infrastructure. |
| Error paths | Happy path plus major joined failures | This covers FR-014-level confidence without exhaustive fault injection. |
| Unsaved export | Allow export, verify saved/export status clarity | Export should use the current on-screen draft while avoiding save-state confusion. |
| Source answers | Verify contract, do not expose answers on reopen | The persistence contract is protected without adding a new reopened-CV feature. |
| Browser coverage | Focused cross-browser smoke | PDF/browser risk gets real coverage without repeating the whole journey everywhere. |
| Completion | Executed proof + closure bundle | Roadmap-backed S-08 should only close after evidence, gates, roadmap, and Linear sync. |

## Scope

**In scope:**

- S-08 contract/invariant test.
- Manual smoke checklist and execution evidence.
- Targeted fixes found by the full saved PDF path.
- Representative language proof across `en`, `pl`, and `ru`.
- Major joined failure checks.
- Focused Chrome/Safari/Firefox/Edge/mobile export checks.
- Repo, roadmap, and Linear closure.

**Out of scope:**

- Answer editing on reopened CVs.
- Autosave or required-save-before-export.
- Persisted PDF files.
- Server-side PDF generation or external PDF service.
- Deep localization or route-prefix i18n.
- New e2e framework.

## Architecture / Approach

S-08 sits above existing slices. It adds a small deterministic contract test and a smoke checklist, then exercises the actual browser flow through `/cv/new`, `CvEditor`, dashboard saved-CV listing, `/cv/[id]`, and the existing export hook. Product code changes are allowed only when the smoke exposes integration defects.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contract And Smoke Harness | S-08 test plus executable checklist | Checklist too vague to prove the flow |
| 2. Full Flow Integration Proof | Happy-path evidence and targeted fixes | Scope creeping into new UX features |
| 3. Failure And Browser Hardening | Major failures and focused browser/export proof | PDF or language defects missed late |
| 4. Closure Bundle | Gates, roadmap, and Linear synced | Status marked done before evidence |

**Prerequisites:** F-01, F-02, S-06, S-07, and S-09 remain implemented and current.
**Estimated effort:** 2-3 implementation sessions across 4 phases, depending on smoke defects.

## Open Risks & Assumptions

- Real PDF/browser behavior still requires manual evidence; unit tests do not prove PDF glyph rendering.
- Linear S-08 mapping should be read back before mutation; expected issue is `CV-14`.
- Manual smoke may expose small status-copy or state-reset defects in the joined editor flow.

## Success Criteria (Summary)

- A signed-in user completes generate -> edit -> save -> reopen -> edit -> export with a readable PDF.
- Output language survives generation, save, reopen, and export across English, Polish, and Russian proof cases.
- Repo gates pass and S-08 is closed consistently in `change.md`, roadmap, and Linear.
