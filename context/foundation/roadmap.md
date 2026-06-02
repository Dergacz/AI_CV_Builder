---
project: AI CV Builder
version: 1
status: draft
created: 2026-06-01
updated: 2026-06-01
prd_version: 1
main_goal: speed
top_blocker: decisions
---

# Roadmap: AI CV Builder

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

AI CV Builder helps first-time or low-confidence CV creators get past the blank-page moment by turning guided self-description into a structured, professional CV. The MVP must keep the user out of full document-editor complexity while still producing a clean template, section edits, saved CVs, and PDF export.

## North star

**S-08: User can complete the full saved PDF flow in a supported language** - this is the first full proof that the product promise works end to end under the `speed` goal.

Here, north star means the smallest end-to-end slice whose successful delivery proves the main product promise; it is placed as early as its prerequisites allow because later work only matters if this flow works.

## At a glance

| ID   | Change ID                           | Outcome (user can ...)                                                             | Prerequisites          | PRD refs                                 | Status   |
| ---- | ----------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------- | -------- |
| F-01 | generation-export-decision-contract | (foundation) generation and PDF export decisions are captured as minimal contracts | -                      | NFR: Export reliability, Response timing | ready    |
| F-02 | cv-persistence-privacy-contract     | (foundation) owner-only saved-CV persistence is defined enough to plan save/reopen | -                      | Access Control, NFR: Privacy, Retention  | ready    |
| S-01 | product-landing-start               | user can understand the value proposition and start CV creation                    | -                      | FR-001, FR-002                           | ready    |
| S-02 | account-access-for-cv-work          | user can sign up, log in, and reach the CV workspace                               | -                      | FR-003                                   | ready    |
| S-03 | guided-questionnaire-capture        | user can create a new CV by answering a simple guided questionnaire                | S-01, S-02             | US-01, FR-004, FR-005                    | proposed |
| S-04 | generated-cv-draft                  | user can receive a usable structured CV draft from questionnaire answers           | F-01, S-03             | US-01, FR-006, FR-012, FR-013, FR-014    | blocked  |
| S-05 | cv-template-section-editing         | user can review the draft in one clean template and edit named sections            | S-04                   | US-01, FR-007, FR-008                    | proposed |
| S-06 | saved-cv-library                    | user can save CV changes and reopen previous CVs from their account                | F-02, S-02             | FR-009, FR-011                           | blocked  |
| S-07 | pdf-export                          | user can export the reviewed CV as a clean PDF and see export failure states       | F-01, S-05             | US-01, FR-010, FR-014                    | blocked  |
| S-08 | full-saved-pdf-flow                 | user can complete the full saved PDF flow in English, Polish, or Russian           | F-01, F-02, S-06, S-07 | US-01, FR-015                            | blocked  |

## Streams

Navigation aid - groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                      | Chain                                | Note                                                                                    |
| ------ | -------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| A      | Entry and account          | `S-01` -> `S-02` -> `S-03`           | Opens the fastest path into the core questionnaire without waiting on deeper decisions. |
| B      | Generation and export      | `F-01` -> `S-04` -> `S-05` -> `S-07` | Resolves the decision blocker around the generated draft and PDF path.                  |
| C      | Persistence and completion | `F-02` -> `S-06` -> `S-08`           | Joins Streams A and B at `S-08` for the full saved PDF flow.                            |

## Baseline

What's already in place in the codebase as of `2026-06-01` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present - web app scaffold, routing, component system, styling, and build scripts exist.
- **Backend / API:** partial - auth API routes exist, but product CV generation/save/export routes are not implemented.
- **Data:** partial - managed data client and local config exist, but there are no CV tables, migrations, or seeded product data.
- **Auth:** present - email/password auth and route protection exist.
- **Deploy / infra:** present - edge deployment config and CI exist.
- **Observability:** partial - platform observability is enabled, but app-level error tracking is not defined.

## Foundations

### F-01: Generation and export decision contract

- **Outcome:** (foundation) generation output, PDF export behavior, timeout/error boundaries, and verification criteria are decided enough for the generated draft and PDF slices to be planned.
- **Change ID:** generation-export-decision-contract
- **PRD refs:** NFR: Export reliability, Response timing
- **Unlocks:** S-04, S-07, S-08
- **Prerequisites:** -
- **Parallel with:** F-02, S-01, S-02
- **Blockers:** -
- **Unknowns:**
  - Which generation output contract is sufficient for Summary, Experience, Education, Skills, and Languages? - Owner: team. Block: no.
  - Which PDF export approach can meet readable formatting without delaying launch? - Owner: team. Block: no.
- **Risk:** If these decisions wait until implementation, S-04 and S-07 can drift into incompatible generation and export assumptions.
- **Status:** ready

### F-02: CV persistence and privacy contract

- **Outcome:** (foundation) the minimum owner-only saved-CV contract is defined enough for save/reopen behavior to be planned without building a broad data layer in advance.
- **Change ID:** cv-persistence-privacy-contract
- **PRD refs:** Access Control, NFR: Privacy, Retention
- **Unlocks:** S-06, S-08
- **Prerequisites:** -
- **Parallel with:** F-01, S-01, S-02
- **Blockers:** -
- **Unknowns:**
  - What is the smallest persisted CV shape that supports edit, save, reopen, and export? - Owner: team. Block: no.
- **Risk:** Overbuilding persistence would slow the launch path; under-defining ownership would risk privacy and saved-CV reliability.
- **Status:** ready

## Slices

### S-01: Product landing and start

- **Outcome:** user can understand that the app turns their answers into a professional CV and can start CV creation from the landing page.
- **Change ID:** product-landing-start
- **PRD refs:** FR-001, FR-002
- **Prerequisites:** -
- **Parallel with:** F-01, F-02, S-02
- **Blockers:** -
- **Unknowns:** -
- **Risk:** If the landing page promises "magic AI" instead of guided input, the first users may enter the flow with the wrong expectations.
- **Status:** ready

### S-02: Account access for CV work

- **Outcome:** user can sign up, log in, and reach the CV workspace that will hold their saved CVs.
- **Change ID:** account-access-for-cv-work
- **PRD refs:** FR-003
- **Prerequisites:** -
- **Parallel with:** F-01, F-02, S-01
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Auth already exists, but the product flow still needs to make account access feel like part of CV creation rather than a starter dashboard.
- **Status:** ready

### S-03: Guided questionnaire capture

- **Outcome:** user can create a new CV by answering a guided questionnaire written in simple, non-CV language.
- **Change ID:** guided-questionnaire-capture
- **PRD refs:** US-01, FR-004, FR-005
- **Prerequisites:** S-01, S-02
- **Parallel with:** F-01, F-02
- **Blockers:** -
- **Unknowns:**
  - Which questions collect enough structure for a useful first generated CV without feeling like a professional resume form? - Owner: team. Block: no.
- **Risk:** This is where the blank-page problem is reduced; a questionnaire that is too thin will make generation look weak later.
- **Status:** proposed

### S-04: Generated CV draft

- **Outcome:** user can receive a usable structured CV draft from questionnaire answers, including clear loading and major failure states.
- **Change ID:** generated-cv-draft
- **PRD refs:** US-01, FR-006, FR-012, FR-013, FR-014
- **Prerequisites:** F-01, S-03
- **Parallel with:** S-06
- **Blockers:** -
- **Unknowns:**
  - F-01 must decide the generation output contract and timeout/error boundaries before this can be planned. - Owner: team. Block: yes.
- **Risk:** This slice proves whether everyday-language answers can become a professional draft; it should not wait behind editing or dashboard work.
- **Status:** blocked

### S-05: CV template and section editing

- **Outcome:** user can review the generated CV in one clean professional template and edit Summary, Experience, Education, Skills, and Languages.
- **Change ID:** cv-template-section-editing
- **PRD refs:** US-01, FR-007, FR-008
- **Prerequisites:** S-04
- **Parallel with:** S-06
- **Blockers:** -
- **Unknowns:**
  - What section-editing controls keep editing simple without becoming a full document editor? - Owner: team. Block: no.
- **Risk:** Editing must build trust in the generated draft while preserving the PRD boundary against advanced layout editing.
- **Status:** proposed

### S-06: Saved CV library

- **Outcome:** user can save CV changes and reopen previously created CVs from their account.
- **Change ID:** saved-cv-library
- **PRD refs:** FR-009, FR-011
- **Prerequisites:** F-02, S-02
- **Parallel with:** S-04, S-05, S-07
- **Blockers:** -
- **Unknowns:**
  - F-02 must settle the minimum persisted CV shape before save/reopen behavior can be planned. - Owner: team. Block: yes.
- **Risk:** Saving and reopening are required for real usefulness, but the dashboard should stay minimal and not distract from finishing the first CV.
- **Status:** blocked

### S-07: PDF export

- **Outcome:** user can export the reviewed CV as a clean, readable PDF and see clear export failure states if export fails.
- **Change ID:** pdf-export
- **PRD refs:** US-01, FR-010, FR-014
- **Prerequisites:** F-01, S-05
- **Parallel with:** S-06
- **Blockers:** -
- **Unknowns:**
  - F-01 must decide the PDF export approach and verification criteria before this can be planned. - Owner: team. Block: yes.
- **Risk:** PDF quality is a guardrail; a late export surprise would threaten the whole launch path.
- **Status:** blocked

### S-08: Full saved PDF flow

- **Outcome:** user can complete the full flow from starting a CV to exporting a saved PDF in English, Polish, or Russian.
- **Change ID:** full-saved-pdf-flow
- **PRD refs:** US-01, FR-015
- **Prerequisites:** F-01, F-02, S-06, S-07
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:**
  - Which UI text must be translated for launch, and how will CV output language be selected without deep localization? - Owner: team. Block: yes.
- **Risk:** This is the chosen first full proof; it intentionally waits until generation, save/reopen, PDF export, and lightweight language support can be exercised together.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID                           | Suggested issue title                                       | Ready for `/10x-plan` | Notes                                                        |
| ---------- | ----------------------------------- | ----------------------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| F-01       | generation-export-decision-contract | Define generation and PDF export contracts                  | yes                   | Run `/10x-plan generation-export-decision-contract`          |
| F-02       | cv-persistence-privacy-contract     | Define saved-CV persistence and owner privacy contract      | yes                   | Can run in parallel with F-01                                |
| S-01       | product-landing-start               | Replace starter landing with product landing and start path | yes                   | Run `/10x-plan product-landing-start`                        |
| S-02       | account-access-for-cv-work          | Connect account access to the CV workspace                  | yes                   | Auth baseline exists                                         |
| S-03       | guided-questionnaire-capture        | Build guided questionnaire capture                          | no                    | Requires S-01 and S-02                                       |
| S-04       | generated-cv-draft                  | Generate usable CV draft from questionnaire answers         | no                    | Blocked until F-01 resolves generation decisions             |
| S-05       | cv-template-section-editing         | Add CV template review and section editing                  | no                    | Requires S-04                                                |
| S-06       | saved-cv-library                    | Save and reopen CVs from account                            | no                    | Blocked until F-02 resolves persistence decisions            |
| S-07       | pdf-export                          | Export reviewed CV as PDF                                   | no                    | Blocked until F-01 resolves export decisions and S-05 exists |
| S-08       | full-saved-pdf-flow                 | Complete saved PDF flow with language support               | no                    | Requires F-01, F-02, S-06, and S-07                          |

## Open Roadmap Questions

1. **Which generation output contract is sufficient for the editable CV sections?** - Owner: team. Block: S-04.
2. **Which PDF export approach can reliably produce a clean CV without delaying launch?** - Owner: team. Block: S-07.
3. **What is the smallest persisted CV shape that supports edit, save, reopen, and export?** - Owner: team. Block: S-06.
4. **How should English, Polish, and Russian be selected for UI text and CV output without deep localization?** - Owner: team. Block: S-08.

## Parked

- **Old CV upload/import** - Why parked: PRD Non-Goals keep v1 focused on blank-page start-from-scratch flow.
- **Multiple templates and advanced visual customization** - Why parked: PRD Non-Goals keep the MVP to one clean professional template.
- **Full document editor** - Why parked: PRD Non-Goals exclude drag-and-drop, layout editing, section reordering, and advanced formatting.
- **Per-section AI regeneration** - Why parked: PRD Non-Goals keep AI regeneration full-CV only in v1.
- **Deep localization** - Why parked: PRD Non-Goals allow English, Polish, and Russian support without country-specific resume norms.
- **Subscription or billing system** - Why parked: PRD Non-Goals exclude payment scope from the MVP.
- **Job-description-based CV tailoring** - Why parked: PRD Non-Goals defer tailoring complexity beyond the start-from-scratch flow.
- **Cover letter generation** - Why parked: PRD Non-Goals keep cover letters outside the core MVP.

## Done

<!-- Empty on first generation. `/10x-archive` appends entries here when matching changes are archived. -->
