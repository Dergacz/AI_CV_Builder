---
project: AI CV Builder
version: 1
status: draft
created: 2026-06-01
updated: 2026-06-07
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

**Status legend** (mutually exclusive):

- `done` - implemented and merged.
- `ready` - all prerequisites met; ready to hand to `/10x-plan`.
- `blocked` - one or more prerequisites are not yet implemented (see **Blocked by**).

| ID   | Change ID                           | Outcome (user can ...)                                                                                                              | Prerequisites                | PRD refs                                 | Status  | Blocked by |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------- | ------- | ---------- |
| F-01 | generation-export-decision-contract | (foundation) generation and PDF export decisions are captured as minimal contracts                                                  | -                            | NFR: Export reliability, Response timing | done    | -          |
| F-02 | cv-persistence-privacy-contract     | (foundation) owner-only saved-CV persistence is defined enough to plan save/reopen                                                  | -                            | Access Control, NFR: Privacy, Retention  | done    | -          |
| S-01 | product-landing-start               | user can understand the value proposition and start CV creation                                                                     | -                            | FR-001, FR-002                           | done    | -          |
| S-02 | account-access-for-cv-work          | user can sign up, log in, and reach the CV workspace                                                                                | -                            | FR-003                                   | done    | -          |
| S-03 | guided-questionnaire-capture        | user can create a new CV by answering a simple guided questionnaire                                                                 | S-01, S-02                   | US-01, FR-004, FR-005                    | done    | -          |
| S-04 | generated-cv-draft                  | user can receive a usable structured CV draft from questionnaire answers                                                            | F-01, S-03                   | US-01, FR-006, FR-012, FR-013, FR-014    | done    | -          |
| S-05 | cv-template-section-editing         | user can review the draft in one clean template and edit named sections                                                             | S-04                         | US-01, FR-007, FR-008                    | done    | -          |
| S-06 | saved-cv-library                    | user can save CV changes and reopen previous CVs from their account                                                                 | F-02, S-02                   | FR-009, FR-011                           | done    | -          |
| S-07 | pdf-export                          | user can export the reviewed CV as a clean PDF and see export failure states                                                        | F-01, S-05                   | US-01, FR-010, FR-014                    | done    | -          |
| S-09 | interface-localization              | user can use the whole app interface (landing, auth, dashboard, questionnaire, review, error states) in English, Polish, or Russian | S-01, S-02, S-03             | US-01, FR-015                            | done    | -          |
| S-08 | full-saved-pdf-flow                 | user can complete the full saved PDF flow in English, Polish, or Russian                                                            | F-01, F-02, S-06, S-07, S-09 | US-01, FR-015                            | ready   | -          |

**Ready now:** S-08 (`full-saved-pdf-flow`) - all prerequisites are complete; this is the north star integration slice.

## Streams

Navigation aid - groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                      | Chain                                | Note                                                                                                              |
| ------ | -------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| A      | Entry and account          | `S-01` -> `S-02` -> `S-03`           | Opens the fastest path into the core questionnaire without waiting on deeper decisions.                           |
| B      | Generation and export      | `F-01` -> `S-04` -> `S-05` -> `S-07` | Resolves the decision blocker around the generated draft and PDF path.                                            |
| C      | Persistence and completion | `F-02` -> `S-06` -> `S-08`           | Joins Streams A and B at `S-08` for the full saved PDF flow.                                                      |
| D      | Interface localization     | `S-03` -> `S-09` -> `S-08`           | Establishes the multilingual UI once; joins the completion track at `S-08`. Separate from per-CV output language. |

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
- **Decision artifact:** `context/changes/generation-export-decision-contract/decision-contract.md`
- **Spike artifact:** `context/changes/generation-export-decision-contract/pdf-runtime-spike.md`
- **Risk:** If these decisions wait until implementation, S-04 and S-07 can drift into incompatible generation and export assumptions.
- **Status:** done

### F-02: CV persistence and privacy contract

- **Outcome:** (foundation) the minimum owner-only saved-CV contract is defined enough for save/reopen behavior to be planned without building a broad data layer in advance.
- **Change ID:** cv-persistence-privacy-contract
- **PRD refs:** Access Control, NFR: Privacy, Retention
- **Unlocks:** S-06, S-08
- **Prerequisites:** -
- **Parallel with:** F-01, S-01, S-02
- **Blockers:** -
- **Decision artifact:** `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`
- **Risk:** Overbuilding persistence would slow the launch path; under-defining ownership would risk privacy and saved-CV reliability.
- **Status:** done

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
- **Status:** done

### S-02: Account access for CV work

- **Outcome:** user can sign up, log in, and reach the CV workspace that will hold their saved CVs.
- **Change ID:** account-access-for-cv-work
- **PRD refs:** FR-003
- **Prerequisites:** -
- **Parallel with:** F-01, F-02, S-01
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Auth already exists, but the product flow still needs to make account access feel like part of CV creation rather than a starter dashboard.
- **Status:** done

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
- **Status:** done

### S-04: Generated CV draft

- **Outcome:** user can receive a usable structured CV draft from questionnaire answers, including clear loading and major failure states.
- **Change ID:** generated-cv-draft
- **PRD refs:** US-01, FR-006, FR-012, FR-013, FR-014
- **Prerequisites:** F-01 (done), S-03 (done)
- **Parallel with:** S-06
- **Blocked by:** - (all prerequisites met)
- **Unknowns:**
  - F-01 and S-03 are both resolved; the questionnaire answer contract (`QUESTIONNAIRE_VERSION`, output language) from S-03 is the input to draft generation. - Owner: team. Block: no.
- **Risk:** This slice proves whether everyday-language answers can become a professional draft; it should not wait behind editing or dashboard work.
- **Status:** done

### S-05: CV template and section editing

- **Outcome:** user can review the generated CV in one clean professional template and edit Summary, Experience, Education, Skills, and Languages.
- **Change ID:** cv-template-section-editing
- **PRD refs:** US-01, FR-007, FR-008
- **Prerequisites:** S-04 (done)
- **Parallel with:** S-06
- **Blocked by:** - (all prerequisites met)
- **Unknowns:**
  - What section-editing controls keep editing simple without becoming a full document editor? - Owner: team. Block: no.
  - User-facing strings introduced by this slice are registered into the en/pl/ru i18n catalog per the S-09 convention, so the editing UI is translated by the time S-08 runs. - Owner: team. Block: no.
- **Risk:** Editing must build trust in the generated draft while preserving the PRD boundary against advanced layout editing.
- **Status:** done

### S-06: Saved CV library

- **Outcome:** user can save CV changes and reopen previously created CVs from their account.
- **Change ID:** saved-cv-library
- **PRD refs:** FR-009, FR-011
- **Prerequisites:** F-02 (done), S-02 (done)
- **Parallel with:** S-04, S-05, S-07
- **Blocked by:** - (all prerequisites met)
- **Unknowns:**
  - F-02 and S-02 are resolved; keep the saved-CV library minimal and owner-only when planning this slice. - Owner: team. Block: no.
- **Risk:** Saving and reopening are required for real usefulness, but the dashboard should stay minimal and not distract from finishing the first CV.
- **Status:** done

### S-07: PDF export

- **Outcome:** user can export the reviewed CV as a clean, readable PDF and see clear export failure states if export fails.
- **Change ID:** pdf-export
- **PRD refs:** US-01, FR-010, FR-014
- **Prerequisites:** F-01 (done), S-05 (done)
- **Parallel with:** S-06
- **Blocked by:** - (all prerequisites met)
- **Unknowns:**
  - F-01 and S-05 are both resolved; the reviewed CV template is available as the input to final PDF export, which can now be planned against the completed contract. - Owner: team. Block: no.
  - Export-related user-facing strings (including failure states) live in a centralized English-only `cv-export-copy.ts` module, ready for S-09 to localize (the en/pl/ru catalog itself is owned by S-09). - Owner: team. Block: no.
- **Risk:** PDF quality is a guardrail; a late export surprise would threaten the whole launch path.
- **Status:** done

### S-08: Full saved PDF flow

- **Outcome:** user can complete the full flow from starting a CV to exporting a saved PDF in English, Polish, or Russian.
- **Change ID:** full-saved-pdf-flow
- **PRD refs:** US-01, FR-015
- **Prerequisites:** F-01 (done), F-02 (done), S-06 (done), S-07 (done), S-09 (done)
- **Parallel with:** -
- **Blocked by:** - (all prerequisites met)
- **Unknowns:**
  - Interface translation is implemented by S-09; this slice's remaining unknown is integration-only - verifying the full start -> save -> export flow renders correctly in each of English, Polish, and Russian. - Owner: team. Block: no.
- **Risk:** This is the chosen first full proof; it intentionally waits until generation, save/reopen, PDF export, and the multilingual UI can be exercised together.
- **Status:** ready

### S-09: Interface localization (multilingual UI)

- **Outcome:** user can use the entire app interface - landing, auth, dashboard, guided questionnaire, draft review, and error/empty states - in English, Polish, or Russian, choosing their interface language independently of each CV's output language.
- **Change ID:** interface-localization
- **PRD refs:** US-01, FR-015
- **Prerequisites:** S-01 (done), S-02 (done), S-03 (done)
- **Parallel with:** S-04, S-05, S-06, S-07
- **Blocked by:** - (all prerequisites met)
- **Unknowns:**
  - Locale strategy: lightweight message-catalog approach (extending the existing `landingContentByLocale` pattern in `src/lib/landing-content.ts`) vs. Astro's built-in i18n routing. - Owner: team. Block: no.
  - How interface language is persisted and switched (cookie or session vs. account preference), and whether routes stay unprefixed or move to `/[lang]/`. - Owner: team. Block: no.
- **Convention:** UI language is a separate preference from per-CV output language; the existing `CvOutputLanguage` selection (`src/lib/cv-questionnaire.ts`) is unchanged. Later UI-bearing slices (S-05, S-07) register their user-facing strings into the en/pl/ru message catalog as part of their own implementation, so no string is left English-only when S-08 runs.
- **Risk:** If scope drifts into deep localization (date/number/currency formats, country-specific resume norms), it pulls a parked non-goal onto the launch path and threatens the `speed` goal. Keep to UI-string translation only.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                           | Suggested issue title                                       | Ready for `/10x-plan` | Notes                                                                                                            |
| ---------- | ----------------------------------- | ----------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F-01       | generation-export-decision-contract | Define generation and PDF export contracts                  | no                    | Implemented; use completed contract for S-04 and S-07                                                            |
| F-02       | cv-persistence-privacy-contract     | Define saved-CV persistence and owner privacy contract      | no                    | Implemented; use completed contract for S-06 and S-08                                                            |
| S-01       | product-landing-start               | Replace starter landing with product landing and start path | no                    | Implemented; landing start path is complete                                                                      |
| S-02       | account-access-for-cv-work          | Connect account access to the CV workspace                  | no                    | Implemented; workspace shell is complete                                                                         |
| S-03       | guided-questionnaire-capture        | Build guided questionnaire capture                          | no                    | Implemented; guided questionnaire and review are complete                                                        |
| S-04       | generated-cv-draft                  | Generate usable CV draft from questionnaire answers         | no                    | Implemented; OpenAI generation service, API route, and questionnaire generation UI are complete                  |
| S-05       | cv-template-section-editing         | Add CV template review and section editing                  | no                    | Implemented; clean template review and per-section editing are complete                                          |
| S-06       | saved-cv-library                    | Save and reopen CVs from account                            | no                    | Implemented; save/reopen library, owner-only API, and delete are complete                                        |
| S-07       | pdf-export                          | Export reviewed CV as PDF                                   | no                    | Implemented; browser-side @react-pdf/renderer export with bundled Noto Sans (en/pl/ru), failure states           |
| S-08       | full-saved-pdf-flow                 | Complete saved PDF flow with language support               | yes                   | F-01, F-02, S-06, S-07, and S-09 resolved; ready for the north star integration slice                            |
| S-09       | interface-localization              | Translate the app interface into English, Polish, Russian   | no                    | Implemented; UI language is separate from CV output language; UI-string translation only                         |

## Open Roadmap Questions

1. **Which generation output contract is sufficient for the editable CV sections?** - Owner: team. Block: S-04.
2. **Which PDF export approach can reliably produce a clean CV without delaying launch?** - Resolved by S-07: browser-side `@react-pdf/renderer` rendering the structured draft, with bundled Noto Sans (en/pl/ru) and the lib kept out of the SSR/Worker bundle via `client:only` islands. Owner: team. Block: (closed).
3. **How should English, Polish, and Russian be selected for UI text and CV output without deep localization?** - Resolved by S-09: UI text uses a separate lightweight message catalog and cookie-backed interface language, chosen independently of each CV's output language; CV output language remains handled in S-03/S-04. Owner: team. Block: (closed).

## Parked

- **Old CV upload/import** - Why parked: PRD Non-Goals keep v1 focused on blank-page start-from-scratch flow.
- **Multiple templates and advanced visual customization** - Why parked: PRD Non-Goals keep the MVP to one clean professional template.
- **Full document editor** - Why parked: PRD Non-Goals exclude drag-and-drop, layout editing, section reordering, and advanced formatting.
- **Per-section AI regeneration** - Why parked: PRD Non-Goals keep AI regeneration full-CV only in v1.
- **Deep localization** - Why parked: PRD Non-Goals allow English, Polish, and Russian support without country-specific resume norms. S-09 covers UI-string translation only; date/number/currency formatting and country-specific resume norms stay out of scope.
- **Subscription or billing system** - Why parked: PRD Non-Goals exclude payment scope from the MVP.
- **Job-description-based CV tailoring** - Why parked: PRD Non-Goals defer tailoring complexity beyond the start-from-scratch flow.
- **Cover letter generation** - Why parked: PRD Non-Goals keep cover letters outside the core MVP.

## Done

- **F-01 `generation-export-decision-contract`** - Implemented on 2026-06-03. Decision contract and PDF runtime spike are in `context/changes/generation-export-decision-contract/`; unlocks S-04/S-07 planning once their remaining prerequisites are ready.
- **F-02 `cv-persistence-privacy-contract`** - Implemented on 2026-06-03. Persistence/privacy contract is in `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`; unlocks S-06/S-08 planning once their remaining prerequisites are ready.
- **S-01 `product-landing-start`** - Implemented on 2026-06-03. Product landing now replaces the starter homepage and sends signed-out users to `/auth/signup` and signed-in users to `/dashboard`; unlocks S-03 planning once S-02 is ready.
- **S-02 `account-access-for-cv-work`** - Implemented on 2026-06-04. Account redirects, product auth pages, and protected CV workspace shell are complete; unlocks S-03 and S-06 planning.
- **S-03 `guided-questionnaire-capture`** - Implemented on 2026-06-04. Protected `/cv/new` route, client-only guided questionnaire island, and read-only review end state are complete; questionnaire answer contract (`QUESTIONNAIRE_VERSION`, output language) unlocks S-04 planning.
- **S-04 `generated-cv-draft`** - Implemented on 2026-06-05. OpenAI generation service (`src/lib/services/cv-generation.ts`), `/api/cv/generate` route with content-length validation, and the questionnaire-driven generation UI with loading/failure states are complete; the structured draft (`GeneratedCvDraft`) unlocks S-05 planning.
- **S-05 `cv-template-section-editing`** - Implemented on 2026-06-05. Clean professional CV template review with per-section editing (Summary, Experience, Education, Skills, Languages), a regenerate-discard guard, and accessibility improvements are complete; the reviewed CV template unlocks S-07 (pdf-export) planning.
- **S-06 `saved-cv-library`** - Implemented on 2026-06-06. First DB migration (`public.cvs` with owner-only RLS + `updated_at` trigger), typed Supabase client, owner-enforcing repository, saved-CV API (`/api/cv`, `/api/cv/[id]`), save bar in the creation flow, bookmarkable `/cv/[id]` reopen route, and dashboard library with delete are complete; questionnaire answers are persisted in `source_snapshot` and restored on reopen. Unblocks S-08 once S-07 and S-09 land.
- **S-07 `pdf-export`** - Implemented on 2026-06-07. Browser-side PDF export via lazily-loaded `@react-pdf/renderer` (`CvPdfDocument` over the structured draft + a name header), `useCvExport` state machine, and an Export button in the editor save bar with inline failure states (`export_failed` / `service_unavailable`, CV stays visible, retry). Bundled Noto Sans (Latin/Latin-Ext/Cyrillic) renders en/pl/ru correctly; the heavy lib is kept out of the SSR/Worker bundle by switching the `/cv/new` and `/cv/[id]` islands to `client:only`. Pure helpers (`cv-export-filename`, `cv-export-error`) are unit-tested; the render is manual QA per the F-01 spike. Leaves only S-09 before the S-08 north star.
- **S-09 `interface-localization`** - Implemented on 2026-06-07. Lightweight cookie-backed UI locale selection (`en`, `pl`, `ru`) localizes landing, auth, dashboard, questionnaire, editor/review, saved-CV, export, and major error/empty states while keeping URLs unprefixed. CV output language, saved CV language, durable titles, and exported content remain independent from the interface locale. Review triage removed language switching from stateful CV edit screens for MVP, neutralized name-only saved-title fallback text, accepted deterministic client catalog selection as an implementation deviation, and added fallback handling for unknown API error buckets. Unblocks S-08.
