# Core-Flow Regression Net Implementation Plan

## Overview

Build a **minimal regression net** that locks in the current behavior of the existing core flow — questionnaire → AI generation → section editing → save → PDF export → reopen — at the exact seams the upcoming launch-safety gates (S-02 email verification, S-03 consent gate, S-04 Google auth, S-06 daily-generation limit) will touch. The net exists so those gates **cannot silently break the working flow** (roadmap F-02, PRD FR-013). It is a characterization net over the *existing* path only — not a general test-suite rewrite.

The flow already works mechanically and has solid unit/contract coverage at the edges (schemas, message mappers, filename, language boundary) plus a happy-path E2E. The gaps this plan fills are the four places where a future gate could regress behavior undetected: the **generation service** (today fully mocked away), the **save failure envelope**, **PDF output quality** (an explicit F-02 goal with zero render coverage), and a **full-path reachability E2E** that proves a normal verified user still completes the funnel.

## Current State Analysis

Test infra already exists (Vitest + Playwright); patterns are mature. What's present vs missing for the core flow:

**Already covered (do NOT re-do):**

- **Schemas/contracts:** `src/lib/cv-save.test.ts` (cvAnswersSchema, cvSaveSchema, defaultCvTitle, `buildCvInsert` source_snapshot), `src/lib/cv-draft-validation.test.ts` + `cv-draft-agreement.test.ts` (client edit guards ⊆ zod), `src/lib/cv-full-flow-contract.test.ts` (language mirroring, filenames, content-vs-UI-language separation).
- **Export edges:** `src/lib/cv-export-filename.test.ts`, `src/lib/cv-export-error.test.ts` (`classifyExportError` buckets).
- **Save route (partial):** `src/pages/api/cv/index.test.ts` — only the 40 KB body-size guard (413).
- **E2E:** `e2e/seed.spec.ts` (exemplar: questionnaire → mocked generate → real save → reopen-persists), `e2e/cv-persistence.spec.ts` (R1 persistence), `e2e/auth-redirect.spec.ts` (R2 middleware guard).
- **Auth / i18n / observability:** covered.

**Gaps this plan closes:**

- **Generation service** `src/lib/services/cv-generation.ts` — the prompt build, `stripNulls`, schema validation, and `service_unavailable` vs `generation_failed` bucketing (`generate.ts:1-303`) are entirely mocked at the `/api/cv/generate` seam and never exercised directly. This is the contract S-06 (daily limit) layers on top of, and `lessons.md` already flags this file as a risk area (unbounded output).
- **Save failure envelope** — only the body-size 413 is tested; auth (401), validation (400), not-found (404), and persistence-failure error envelopes from `src/pages/api/cv/index.ts` + `[id].ts` + `cv-repository.ts` are uncharacterized. The registration→app gates sit on this path.
- **PDF output quality** — `CvPdfDocument.tsx` is never rendered in a test; only filename/error are unit-tested. F-02 explicitly names "no PDF export-quality regression."
- **Full-path reachability** — nothing asserts a verified user can still reach `/cv/new`, generate, **edit a section**, save, reopen, and **export** end-to-end. That single contract is exactly what the gates must preserve.

### Key Discoveries

- `generateCvDraft(answers, { apiKey, model })` returns a `GenerateDraftResponse` discriminated union (`cv-generation.ts:211`). It uses **global `fetch`** + `AbortController` + a 25 s timeout, and **stamps** `schemaVersion`/`language`/`source` server-side (`cv-generation.ts:284-294`) — the model only returns `sections`/`assumptions`/`warnings`. Failure routing: no apiKey / network throw / non-ok response → `unavailable()`; refusal / empty content / bad JSON / schema-nonconforming → `genFailed()` (`cv-generation.ts:203-302`).
- Privacy invariant (`cv-generation.ts:12-13`): the module must never log raw answers/prompt/response/draft. The net should assert no raw-answer leak surfaces in the returned envelope.
- `CvPdfDocument` (`CvPdfDocument.tsx:83`) is a plain function component returning a `@react-pdf` element tree; section headings come from `getCvEditorCopy(outputLanguage)`, empty sections render an empty-state `Text`. **`Font.register` runs at module import** pointing at the browser path `/fonts/NotoSans-*.ttf` (`CvPdfDocument.tsx:20-23`) — that path does not resolve under node/vitest.
- Fonts exist on disk at `public/fonts/NotoSans-Regular.ttf` and `NotoSans-Bold.ttf`. react-pdf is `4.5.1` (`renderToBuffer` available).
- Vitest runs in the **node** environment with **no jsdom / happy-dom / @testing-library** installed (`vitest.config.ts`, package.json). Component-tree assertions must call the component function and walk the returned element tree — not use testing-library.
- E2E patterns (`e2e/README.md`, `seed.spec.ts`): `storageState` verified account (signup on clean DB with confirmations off ⇒ effectively verified), mock seam `page.route('**/api/cv/generate', …)` with `buildGeneratedDraftResponse()` (`e2e/fixtures/cv-draft.ts`), `Date.now()` unique ids, cleanup `page.request.delete('/api/cv/${id}')`, role/label locators, state-waits only.
- Export download path: `useCvExport` builds a blob and triggers a transient-anchor download (`useCvExport.ts:23-31`) — Playwright captures it via the `download` event.

## Desired End State

The four gaps above are covered by regression tests that **demonstrably fail when the protected behavior breaks** (verified via break-to-prove-red, then reverted). After this change:

- `npm test` includes a generation-service contract, a save-failure-envelope contract, and a PDF output-quality characterization.
- `npm run test:e2e` includes one full-path core-flow spec (questionnaire → generate → edit → save → reopen → export) that goes red if any step regresses, plus the retained auth-redirect negative.
- Each new test file documents, in a comment, the deliberate break that was confirmed to turn it red.
- No production source under `src/` is modified except, if strictly required, a small testability seam (preferred: none).

Verify: full `npm test` and `npm run test:e2e` green with local Supabase up; each phase's break-to-prove-red recorded.

## What We're NOT Doing

- **No general test-suite rewrite.** No new unit tests for the questionnaire React component's internal step state, the dashboard listing UI, or per-section editor components beyond the one section folded into the E2E.
- **No real OpenAI calls.** The generation service is characterized with `fetch` stubbed; the E2E keeps the `/api/cv/generate` mock seam.
- **No new E2E error-state spec.** Generation/save failure UX is characterized at the unit layer only (per decision).
- **No pixel/visual PDF regression** (no Argos/snapshot image diffing). PDF quality = content presence + valid-bytes smoke.
- **No changes to the gates themselves** (S-02/03/04/06) — this is the safety net they will later be checked against.
- **No CI workflow changes** — the existing `ci.yml` already runs `npm test`; E2E wiring into CI is out of scope (E2E remains a local gate, as today).

## Implementation Approach

Three unit phases (fast, deterministic, run in node) followed by one E2E phase (the real-path reachability contract). Unit phases are ordered by the seam's blast radius for the gates: generation first (S-06), then save (S-02/S-03), then PDF quality (F-02 explicit goal). The E2E phase folds section-editing and PDF-download into a single coherent full-path spec rather than adding multiple specs, keeping the net minimal.

Every phase applies the project's **break-to-prove-red** discipline: after the test is green, deliberately break the behavior it guards in production code, confirm the test goes red, then revert and record the break in a file comment. A green-only suite is explicitly insufficient (per the "definition of guarded" decision).

## Critical Implementation Details

- **PDF bytes smoke vs node fonts.** `CvPdfDocument.tsx:20-23` registers Noto Sans at module import using the URL path `/fonts/NotoSans-*.ttf`, which is unresolvable under node. The bytes-level assertion must make fonts resolvable before rendering — re-register the `Noto Sans` family from absolute filesystem paths (`public/fonts/NotoSans-Regular.ttf` / `-Bold.ttf`) via `Font.register` inside the test setup. The **render-tree** assertions need no fonts (they walk the React element tree without rasterizing) and should carry the bulk of the content checks; the bytes smoke only asserts a valid, non-trivial PDF is produced.
- **No testing-library available.** Assert PDF content by invoking `CvPdfDocument({ draft, fullName, outputLanguage })` and recursively walking `element.props.children` for the expected `Text` strings — do not add jsdom or @testing-library/react just for this.
- **Generation service uses global `fetch`.** Stub with `vi.stubGlobal('fetch', …)` (and `vi.unstubAllGlobals()` in teardown). Cover the abort/timeout branch by having the stub throw (the service treats any `fetch` throw, including abort, as `service_unavailable`). `new Date()` / `setTimeout` run fine in node and need no faking.
- **E2E verified-user assumption.** The reachability spec must run under the existing `storageState` account (already verified via clean-DB signup), so a *future* email-verification gate does not trivially break the net's own setup — the spec proves the flow works *for a user who has passed the gate*, which is the contract the gates must preserve.

## Phase 1: Generation service contract (unit)

### Overview

Characterize `generateCvDraft` directly with the OpenAI HTTP call stubbed, locking the happy-path stamping and every failure-bucket mapping plus the no-raw-content privacy rule. This is the contract S-06 will sit on.

### Changes Required:

#### 1. Generation service test

**File**: `src/lib/services/cv-generation.test.ts` (new)

**Intent**: Prove `generateCvDraft` maps every documented input condition to the correct `GenerateDraftResponse`, stamps server-owned fields, strips nulls, and never echoes raw answers into the result. Locks the generation contract before the daily-limit gate layers onto the route.

**Contract**: Tests against `generateCvDraft(answers, { apiKey, model })` from `@/lib/services/cv-generation`, stubbing global `fetch`. Cases:
- Missing/empty `apiKey` → `{ ok: false, error: "service_unavailable" }` with no fetch call.
- `fetch` throws (network/abort/timeout) → `service_unavailable`.
- Response `!ok` (e.g. 500) → `service_unavailable`.
- `message.refusal` set → `generation_failed`.
- Empty/missing `content` → `generation_failed`.
- `content` is invalid JSON → `generation_failed`.
- Valid JSON whose shape violates `generatedCvDraftSchema` → `generation_failed`.
- Valid strict-schema content → `{ ok: true, draft }` with `draft.schemaVersion === 1`, `draft.language === answers.outputLanguage`, `draft.source.questionnaireVersion === QUESTIONNAIRE_VERSION`, `source.modelProvider === "openai"`, `source.modelName === model` (and default `gpt-4o-mini` when model omitted), and null-valued optional keys stripped from the model payload.
- Prompt assembly: the request body sent to `fetch` contains a system message and a user message that includes the output-language name and the questionnaire field labels (assert via the stub's captured argument).
- Privacy: the returned envelope (and any error message) contains none of the raw answer values.

Use `vi.stubGlobal('fetch', …)` + `vi.unstubAllGlobals()` teardown. A reusable valid-draft content payload can mirror `e2e/fixtures/cv-draft.ts` (sections/assumptions/warnings only — the service stamps the rest).

### Success Criteria:

#### Automated Verification:

- New test file passes: `npm test -- src/lib/services/cv-generation.test.ts`
- Full unit suite stays green: `npm test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Break-to-prove-red: temporarily change one failure branch in `cv-generation.ts` (e.g. make the non-ok branch return `genFailed()` instead of `unavailable()`), confirm the corresponding test goes red, then revert. Record the break in a file-top comment.

**Implementation Note**: After this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Save seam failure contract (unit)

### Overview

Characterize the error envelopes of the save seam (create/update/get/delete) and the localized save-message buckets, so a registration→app gate that perturbs this path is caught. Extends the existing body-size guard test rather than replacing it.

### Changes Required:

#### 1. Save route error-envelope tests

**File**: `src/pages/api/cv/index.test.ts` (extend) and `src/pages/api/cv/[id].test.ts` (new)

**Intent**: Lock the HTTP contract of the save endpoints for the failure paths the gates could disturb — unauthenticated, invalid body, not-found, and persistence failure — asserting both status code and the `CvErrorResponse` envelope shape.

**Contract**: Drive the route handlers (`GET`/`POST` in `index.ts`; `GET`/`PUT`/`DELETE` in `[id].ts`) with a mocked Astro context (`locals.user`, `request`, injected/mocked Supabase). Assert:
- No `locals.user` → 401 `{ ok: false, error: … }` (no repository call).
- `POST`/`PUT` invalid body (fails `cvSaveSchema`) → 400 envelope.
- `GET`/`PUT`/`DELETE` `[id]` when `getCv`/`updateCv`/`deleteCv` returns not-found → 404 envelope.
- Repository throws / returns failure → the route's persistence-error envelope (not an unhandled 500 leak).
- Existing 40 KB body-size guard (413) remains asserted.

Follow the mocking style already used in `src/pages/api/cv/index.test.ts`. Repository behavior is mocked at the `cv-repository` boundary; do not hit a real DB.

#### 2. Save message-bucket coverage

**File**: `src/lib/cv-save-messages.test.ts` (new, only if not already covered)

**Intent**: Confirm each save/load/delete error bucket maps to localized, non-empty prose across en/pl/ru, so a new gate-introduced error code surfaces a real message rather than a blank.

**Contract**: Assert `cv-save-messages` resolves every error bucket to distinct, non-empty strings per locale. Skip this file if `cv-save.test.ts` already asserts the mapper (verify during implementation; avoid duplication).

### Success Criteria:

#### Automated Verification:

- New/extended tests pass: `npm test -- src/pages/api/cv`
- Full unit suite stays green: `npm test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Break-to-prove-red: temporarily drop the auth check in `POST /api/cv` (return success without `locals.user`), confirm the 401 test goes red, then revert. Record the break in a comment.

**Implementation Note**: Pause for manual confirmation after automated verification passes before proceeding.

---

## Phase 3: PDF output-quality characterization (unit)

### Overview

Render-tree assertions that `CvPdfDocument` emits the draft's content with correct language-driven headings and empty-state branches, plus a bytes smoke proving a valid, non-trivial PDF is produced. Closes the explicit F-02 "no PDF export-quality regression" gap.

### Changes Required:

#### 1. PDF document characterization test

**File**: `src/components/cv/CvPdfDocument.test.ts` (new)

**Intent**: Lock the PDF's content and structure against regression — every section's content appears, headings follow the CV output language (not UI locale), empty sections render their empty-state copy, and the whole thing still renders to a real PDF — without rasterized/visual diffing.

**Contract**: Two layers against `CvPdfDocument` from `@/components/cv/CvPdfDocument`:
- **Render-tree (no fonts needed):** call `CvPdfDocument({ draft, fullName, outputLanguage })` and recursively collect `Text` string children. Assert: summary body, an experience heading, an education heading, a skills label, and a language name from the draft all appear; section titles equal `getCvEditorCopy(outputLanguage).sections.*` for `outputLanguage` ∈ {en, pl, ru} (e.g. ru summary heading "Резюме"); an empty `experience`/`education`/`skills`/`languages` array renders the matching empty-state copy. Use a draft built from the `generatedCvDraftSchema` (reuse the existing contract fixture at `context/changes/generation-export-decision-contract/cv-contract.fixture.json`, as `cv-full-flow-contract.test.ts:19` does).
- **Bytes smoke (fonts required):** re-register `Noto Sans` from `public/fonts/NotoSans-Regular.ttf` / `-Bold.ttf` via `Font.register`, render the document to a Buffer (react-pdf `renderToBuffer`), and assert the output begins with the `%PDF` signature and exceeds a small minimum length. One representative language is sufficient for the smoke.

See Critical Implementation Details for the font-registration gotcha and why the render-tree layer carries the content checks.

### Success Criteria:

#### Automated Verification:

- New test passes: `npm test -- src/components/cv/CvPdfDocument.test.ts`
- Full unit suite stays green: `npm test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Break-to-prove-red: temporarily drop a section (e.g. remove the skills `<Section>`) or swap a heading source, confirm the render-tree test goes red, then revert. Record the break in a comment.
- Open one exported PDF produced by the running app and confirm en/pl/ru text renders with correct glyphs (no tofu) — sanity check that the bytes smoke's font handling matches reality.

**Implementation Note**: Pause for manual confirmation after automated verification passes before proceeding.

---

## Phase 4: Core-flow happy-path + reachability E2E

### Overview

One full-path Playwright spec proving a verified user completes the entire funnel — questionnaire → generate (mocked) → **edit a section** → save → reopen (edit persists) → **export PDF (download)**. This is the reachability contract every future gate must preserve. The existing `auth-redirect.spec.ts` is retained as the negative.

### Changes Required:

#### 1. Full-path core-flow spec

**File**: `e2e/core-flow.spec.ts` (new)

**Intent**: Lock the end-to-end reachability of the core flow for a normal verified user, including a committed section edit surviving reload and a real PDF download — so a gate that over-blocks or breaks any step turns this red.

**Contract**: One independent test using the shared `storageState` session and the `**/api/cv/generate` mock (`buildGeneratedDraftResponse()`):
- Walk `/cv/new` with role/label locators (per `e2e/README.md`): fill name + target role, `Next` ×3 → `Review answers` → `Generate draft`.
- Edit one section (e.g. set `CV title`, and/or open the summary editor, change its value, save the section) before the top-level Save.
- Save via real `POST /api/cv` (wait on the response, capture `cv.id`).
- Navigate to `/cv/${id}`; assert the title heading, the full name heading, **and the edited value** are visible (proves edit→save→persist round-trip + SSR).
- Trigger PDF export and assert a `.pdf` download occurs via Playwright's `download` event with a non-empty body.
- Cleanup: `page.request.delete('/api/cv/${id}')` plus an `afterEach` safety net.

Unique ids via `Date.now()`; state-waits only (no `waitForTimeout`); locators per the project's English accessible names.

#### 2. Retain the negative guard

**File**: `e2e/auth-redirect.spec.ts` (unchanged)

**Intent**: Keep the anonymous-user redirect coverage as the negative half of the reachability contract. No change; named here so the implementer does not remove or duplicate it.

**Contract**: Existing anonymous `/dashboard` and `/cv/new` → `/auth/signin` assertions remain green.

### Success Criteria:

#### Automated Verification:

- New spec passes with local Supabase up: `npm run db:start` then `npm run test:e2e -- core-flow`
- Full E2E suite stays green: `npm run test:e2e`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Break-to-prove-red: temporarily make `POST /api/cv` skip the insert (or break the editor's commit), confirm the reopen/edit-persist assertion goes red, then revert. Record the break in a comment.
- Break-to-prove-red for export: temporarily make the export throw, confirm the download assertion goes red, then revert.
- Confirm the spec runs green on a re-run (idempotent cleanup, no collisions).

**Implementation Note**: Final phase — confirm the full net (`npm test` + `npm run test:e2e`) is green and all break-to-prove-red checks are recorded.

---

## Testing Strategy

### Unit Tests:

- Generation service: happy path, every failure bucket, prompt assembly, privacy (Phase 1).
- Save seam: auth/validation/not-found/persistence error envelopes + message buckets (Phase 2).
- PDF: render-tree content/headings/empty-states across en/pl/ru + valid-bytes smoke (Phase 3).

### Integration / E2E Tests:

- Full core-flow path for a verified user, edit-persist round-trip, real PDF download (Phase 4).
- Retained anonymous redirect negative (Phase 4).

### Manual Testing Steps:

1. For each new test, perform the documented break-to-prove-red and confirm red → revert → green.
2. Export one PDF from the running app in en, pl, and ru; confirm correct glyphs and section content.
3. Re-run the E2E spec to confirm idempotent cleanup.

## Performance Considerations

The PDF bytes smoke and the E2E export add the heaviest runtime. Keep the bytes smoke to one language; keep the E2E to a single full-path test. The render-tree assertions (font-free) carry the bulk of PDF content coverage to stay fast and deterministic.

## Migration Notes

None — additive test-only change. No schema, data, or production-source modifications (except, if unavoidable, a minimal testability seam; preferred: none).

## References

- Roadmap F-02: `context/foundation/roadmap.md:85-96`
- PRD FR-013 + Export reliability: `context/foundation/prd-v3.md:275-278`, `:350`
- E2E conventions: `e2e/README.md`; exemplar `e2e/seed.spec.ts`; fixture `e2e/fixtures/cv-draft.ts`
- Generation service: `src/lib/services/cv-generation.ts:203-303`
- PDF document: `src/components/cv/CvPdfDocument.tsx:20-23, 83-183`
- Existing contract test pattern: `src/lib/cv-full-flow-contract.test.ts:19`
- Lessons (generation risk): `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Generation service contract (unit)

#### Automated

- [x] 1.1 New test file passes: `npm test -- src/lib/services/cv-generation.test.ts` — 5936d36
- [x] 1.2 Full unit suite stays green: `npm test` — 5936d36
- [x] 1.3 Type checking passes: `npm run typecheck` — 5936d36
- [x] 1.4 Linting passes: `npm run lint` — 5936d36

#### Manual

- [x] 1.5 Break-to-prove-red on a failure branch confirmed red → reverted → recorded — 5936d36

### Phase 2: Save seam failure contract (unit)

#### Automated

- [x] 2.1 New/extended save-route tests pass: `npm test -- src/pages/api/cv` — 69db9cf
- [x] 2.2 Full unit suite stays green: `npm test` — 69db9cf
- [x] 2.3 Type checking passes: `npm run typecheck` — 69db9cf
- [x] 2.4 Linting passes: `npm run lint` — 69db9cf

#### Manual

- [x] 2.5 Break-to-prove-red on the auth check confirmed red → reverted → recorded — 69db9cf

### Phase 3: PDF output-quality characterization (unit)

#### Automated

- [x] 3.1 New PDF test passes: `npm test -- src/components/cv/CvPdfDocument.test.ts`
- [x] 3.2 Full unit suite stays green: `npm test`
- [x] 3.3 Type checking passes: `npm run typecheck`
- [x] 3.4 Linting passes: `npm run lint`

#### Manual

- [x] 3.5 Break-to-prove-red on a section/heading confirmed red → reverted → recorded
- [x] 3.6 Exported PDF in en/pl/ru shows correct glyphs and content

### Phase 4: Core-flow happy-path + reachability E2E

#### Automated

- [ ] 4.1 New spec passes with local Supabase: `npm run db:start` then `npm run test:e2e -- core-flow`
- [ ] 4.2 Full E2E suite stays green: `npm run test:e2e`
- [ ] 4.3 Type checking passes: `npm run typecheck`
- [ ] 4.4 Linting passes: `npm run lint`

#### Manual

- [ ] 4.5 Break-to-prove-red on save-insert confirmed red → reverted → recorded
- [ ] 4.6 Break-to-prove-red on export download confirmed red → reverted → recorded
- [ ] 4.7 Spec re-runs green (idempotent cleanup, no collisions)
