# Generated CV Draft Implementation Plan

## Overview

Implement roadmap slice S-04 by turning the captured guided-questionnaire answers into a usable, structured `GeneratedCvDraft` produced by an AI call. The user triggers generation from the existing `/cv/new` review step, sees honest loading feedback, and lands on a minimal readable preview of the draft — or a clear, bucketed failure state with a retry that preserves their answers. This slice proves that everyday-language answers can become a professional structured draft. It does not add CV persistence (S-06), the clean editing template (S-05), or PDF export (S-07).

## Current State Analysis

S-03 is complete: authenticated users move through a guided questionnaire on the protected `/cv/new` route and reach a read-only review screen whose primary action is intentionally disabled ("Generation comes next"). All questionnaire state lives in one client island, `src/components/cv/QuestionnaireFlow.tsx`, and the typed input contract lives in `src/lib/cv-questionnaire.ts` (`CvQuestionnaireAnswers`, `QUESTIONNAIRE_VERSION = "mvp-v1"`, `CvOutputLanguage`).

F-01 is complete and fully specifies the generation output: the `GeneratedCvDraft` shape, five editable sections, supporting `assumptions`/`warnings`, the three user-facing error buckets, the <30s timeout target, and strict anti-fabrication minimal-input rules. A reference fixture exists at `context/changes/generation-export-decision-contract/cv-contract.fixture.json`.

Key gaps in the repo today:

- No AI SDK, no AI provider secret, and no `zod` dependency are installed.
- `astro.config.mjs` declares only `SUPABASE_URL` and `SUPABASE_KEY` in its `env.schema`.
- There is no `src/types.ts` yet (CLAUDE.md designates it for shared types).
- The only API routes are `src/pages/api/auth/*.ts`; there is no `src/pages/api/cv/` directory.

Runtime and privacy constraints: the app runs on Cloudflare Workers via `@astrojs/cloudflare`, so the AI call must be `fetch`-based and Workers-compatible (no Node-only SDK assuming filesystem/native binaries), and the request must remain synchronous (F-01 forbids queues/jobs). F-02 treats questionnaire answers as sensitive — raw answer payloads must not be logged.

## Desired End State

A signed-in user who completes the questionnaire can press **Generate draft** on the review step. The browser shows a simple spinner with honest status text while a single authenticated `POST /api/cv/generate` request runs. On success, the same `/cv/new` island swaps the review for a minimal, readable preview of the generated draft: Summary, Experience, Education, Skills, Languages, plus any assumptions and warnings — clearly labelled as a draft, with copy noting that the clean template and editing come next. On failure, the user sees a plain message mapped to one of F-01's buckets (`generation_failed` or `service_unavailable`) and a **Retry** button that re-submits the same in-memory answers; their answers are never lost. When the AI key is not configured, the route returns `service_unavailable` rather than crashing.

Verification: `POST /api/cv/generate` returns a `GeneratedCvDraft` with `schemaVersion: 1` and all five section keys present; sparse input yields warnings rather than fabricated facts; the route is auth-gated and rejects unauthenticated/invalid requests; `npm run lint` and `npm run build` pass; source searches confirm no persistence, no PDF, no raw-answer logging, and no S-05 template/editing were added.

### Key Discoveries:

- Disabled generation action to replace lives at the review step: `src/components/cv/QuestionnaireFlow.tsx:345` (the Next/"Generation comes next" button) and the review block starting `src/components/cv/QuestionnaireFlow.tsx:256`.
- Input contract S-04 must consume: `src/lib/cv-questionnaire.ts:7` (`CvQuestionnaireAnswers`) and `:1` (`QUESTIONNAIRE_VERSION`).
- Full output contract to mirror exactly: `context/changes/generation-export-decision-contract/decision-contract.md:31` (shape), `:189` (error buckets), `:201` (timeout), `:168` (minimal-input rules).
- Reference output fixture: `context/changes/generation-export-decision-contract/cv-contract.fixture.json:1`.
- API route pattern (uppercase `POST`, `APIRoute`, `createClient(headers, cookies)`): `src/pages/api/auth/signin.ts:16`. Note: these are form-redirect routes; the new route returns JSON instead.
- Server-only secrets are read via `astro:env/server` and declared in `astro.config.mjs:17`; graceful "unconfigured" pattern returns `null`: `src/lib/supabase.ts:6`, mirrored by `src/lib/config-status.ts:14`.
- Auth/user is attached in middleware as `context.locals.user`, and `/cv` is already protected: `src/middleware.ts:4`. API routes under `/cv`... note `/api/cv/...` is NOT under `/cv`, so the route must check `context.locals.user` itself.
- CLAUDE.md conventions: shared types in `src/types.ts`; validate API input with zod; services/business logic in `src/lib/services/`; API routes must `export const prerender = false`.

## What We're NOT Doing

- No CV persistence: no Supabase migration, no `public.cvs` table, no saved-CV route, no save/reopen/delete. The draft is in-memory only (S-06 / F-02 own persistence).
- No clean professional template and no section editing UI — that is S-05. The S-04 preview is intentionally minimal and read-only.
- No PDF export, export route, storage buckets, or `export_failed` UI wiring (S-07 owns export; the bucket stays defined in the contract but is not exercised here).
- No background jobs, queues, polling, streaming, or durable orchestration — generation is one synchronous request (F-01).
- No per-section regeneration, no job-description tailoring, no cover letters, no CV upload/import.
- No UI localization / i18n switcher (S-08). The generated CV content uses the selected `outputLanguage`, but the surrounding UI copy stays English.
- No new test runner (consistent with S-03); verification uses existing repo gates plus manual testing.
- No roadmap status flip to `done` and no tracker sync during implementation; closure is a separate step after acceptance.

## Implementation Approach

Build back-to-front in four phases. First lock the output contract in code: add `zod`, define `GeneratedCvDraft` as a shared type plus a matching zod schema and a discriminated response type, and declare the AI secret. Then implement the generation service (prompt construction, strict OpenAI structured output, timeout, zod validation, error-bucket mapping) behind a JSON API route that is auth-gated and validates its input. Finally wire the existing questionnaire island to call the route, show honest loading, render a minimal draft preview, and handle bucketed failures with answer-preserving retry. A short verification phase runs the repo gates, scope guards, and change-metadata updates.

The single most important reliability decision is enforcing schema conformance two ways: OpenAI's `response_format` `json_schema` (strict) constrains the model, and a zod parse on the server guarantees it before the draft is returned. Anything that fails validation maps to `generation_failed`; provider/network/timeout/missing-key failures map to `service_unavailable`.

## Critical Implementation Details

### Workers runtime + timeout

The OpenAI call must use `fetch` against the OpenAI REST endpoint (Workers-compatible); do not pull in a Node-only SDK that assumes filesystem/native modules. Wrap the call in an `AbortController` with a timeout below the platform/product ceiling (target the F-01 <30s budget, e.g. ~25s) so a slow generation fails as `service_unavailable` instead of hanging. The whole route stays synchronous — no background work.

### Privacy: no raw-answer logging

Questionnaire answers and the generated draft are private CV source material (F-02). The service and route must not `console.log` raw answers, raw model responses, or the draft body. Log only non-sensitive facts (e.g. an error bucket code, a coarse outcome, validation failure counts), never the content.

### Contract must mirror F-01 exactly

`GeneratedCvDraft` and its zod schema must match `decision-contract.md` field-for-field (required vs optional, `schemaVersion: 1`, `language` enum `en|pl|ru`, the five section keys always present, `assumptions`/`warnings` required-but-may-be-empty, the fixed `warnings[].code` enum). The OpenAI `json_schema` and the zod schema are two encodings of the same contract and must stay in sync. Use the fixture as the conformance example.

## Phase 1: Draft Contract And Validation Foundation

### Overview

Establish the typed, validated output contract and the configuration surface, with no runtime behavior yet. This phase is pure foundation so later phases have one authoritative draft shape to build against.

### Changes Required:

#### 1. Add zod dependency

**File**: `package.json`

**Intent**: Provide runtime validation for both the incoming questionnaire answers and the model's draft output, per the CLAUDE.md "validate input with zod" convention.

**Contract**: Add `zod` to `dependencies` and install. No other dependency or script changes.

#### 2. Shared draft type

**File**: `src/types.ts`

**Intent**: Create the shared-types module (currently absent) and export the `GeneratedCvDraft` entity and its sub-types so the service, route, and UI share one definition.

**Contract**: Export `GeneratedCvDraft`, `SummarySection`, `ExperienceItem`, `EducationItem`, `SkillGroup`, `LanguageItem`, `DraftAssumption`, `DraftWarning`, and a `DraftWarningCode` union, matching `decision-contract.md:31` exactly (required/optional fields and `schemaVersion: 1`). Re-export or align the draft type with the zod schema's `z.infer` from the next item to prevent drift (single source of truth).

#### 3. Draft zod schema, error buckets, and response type

**File**: `src/lib/cv-draft.ts`

**Intent**: Encode the F-01 contract as a zod schema for server-side validation, define the three error buckets, and define the API response shape the route returns and the UI consumes.

**Contract**: Export `generatedCvDraftSchema` (zod) whose `z.infer` equals `GeneratedCvDraft`; export `GenerationErrorBucket` as `"generation_failed" | "export_failed" | "service_unavailable"`; export a discriminated `GenerateDraftResponse` union, e.g. `{ ok: true; draft: GeneratedCvDraft }` | `{ ok: false; error: GenerationErrorBucket; message: string }`. Provide the human-friendly default messages for the buckets used by S-04 (`generation_failed`, `service_unavailable`) per `decision-contract.md:189`.

#### 4. Declare AI provider secret

**File**: `astro.config.mjs`

**Intent**: Make the OpenAI key (and model name) available as server-only config through the same `astro:env/server` mechanism used for Supabase, kept optional so missing config degrades gracefully rather than failing the build.

**Contract**: Add `OPENAI_API_KEY` (server, secret, optional) to `env.schema`. Optionally add `OPENAI_MODEL` (server, non-secret, optional) so the model is configurable without code changes. Document both in `.env.example` and `.dev.vars` conventions (names only, no values).

### Success Criteria:

#### Automated Verification:

- `zod` appears in `package.json` dependencies and `npm install` succeeds.
- `src/types.ts` exports `GeneratedCvDraft` and all sub-types listed above.
- `src/lib/cv-draft.ts` exports `generatedCvDraftSchema`, `GenerationErrorBucket`, and `GenerateDraftResponse`, and `z.infer<typeof generatedCvDraftSchema>` is assignable to `GeneratedCvDraft`.
- `astro.config.mjs` declares `OPENAI_API_KEY` (and `OPENAI_MODEL` if added) in `env.schema`.
- Type checking / lint passes: `npm run lint`.

#### Manual Verification:

- Validating `cv-contract.fixture.json` against `generatedCvDraftSchema` succeeds (quick ad-hoc check), confirming the schema matches F-01.
- A draft missing a section key or with an unknown `warnings[].code` is rejected by the schema.

**Implementation Note**: After this phase and automated verification, pause for manual confirmation that the schema faithfully mirrors the F-01 contract before building the service on top of it.

---

## Phase 2: OpenAI Generation Service And API Route

### Overview

Implement the generation logic and expose it through one authenticated JSON endpoint. This is where prompt construction, the strict structured-output call, timeout handling, validation, and error-bucket mapping live.

### Changes Required:

#### 1. CV generation service

**File**: `src/lib/services/cv-generation.ts`

**Intent**: Encapsulate the business logic of turning `CvQuestionnaireAnswers` into a validated `GeneratedCvDraft`, isolated from HTTP concerns so it is independently reasoned about and reusable.

**Contract**: Export an async function taking `CvQuestionnaireAnswers` (and the resolved `OPENAI_API_KEY`/model) and returning a `GenerateDraftResponse`. Responsibilities: (a) build a system+user prompt that enforces F-01's anti-fabrication and minimal-input rules and instructs output in the selected `outputLanguage`; (b) call the OpenAI REST API via `fetch` with `response_format` set to a strict `json_schema` derived from the contract; (c) wrap the call in an `AbortController` timeout (~25s); (d) parse the model JSON and validate with `generatedCvDraftSchema`; (e) stamp `source.questionnaireVersion` (from `QUESTIONNAIRE_VERSION`), `source.generatedAt`, and `source.modelProvider`/`modelName`; (f) map outcomes to buckets — schema/parse failure → `generation_failed`; missing key, network error, non-2xx, or timeout/abort → `service_unavailable`. Must not log raw answers, raw model output, or draft content.

**Contract (prompt note)**: The system prompt must explicitly forbid inventing employers, schools, roles, dates, language proficiency, certifications, achievements, metrics, or personal details, and must prefer empty arrays + warnings over fabricated entries (`decision-contract.md:168`). This is the load-bearing instruction for the product's honesty guarantee.

#### 2. Generation API route

**File**: `src/pages/api/cv/generate.ts`

**Intent**: Provide the single synchronous endpoint the client calls, enforcing auth and input validation before invoking the service.

**Contract**: `export const prerender = false;` and `export const POST: APIRoute`. Steps: reject if `context.locals.user` is absent (401 JSON, not a redirect — this is a fetch endpoint); parse the JSON body and validate it against a zod schema for `CvQuestionnaireAnswers` (required `fullName`, `targetRoleOrGoal`, `outputLanguage` ∈ `en|pl|ru`; optional text fields) — invalid input → 400 JSON `generation_failed`; read `OPENAI_API_KEY` via `astro:env/server` and if absent return `service_unavailable` (mirroring the Supabase `null` pattern, `supabase.ts:6`); otherwise call the service and return its `GenerateDraftResponse` as JSON with an appropriate status (200 on `ok`, 4xx/5xx on error buckets). Never echo raw answers in logs or error messages.

#### 3. Questionnaire answers input schema

**File**: `src/lib/cv-questionnaire.ts` (extend) or co-locate in the route

**Intent**: Validate the incoming request body against the same contract the questionnaire produces, so the route can trust its input.

**Contract**: Add a zod schema matching `CvQuestionnaireAnswers` (trimmed required `fullName` and `targetRoleOrGoal`, `outputLanguage` restricted to `cvOutputLanguages`, optional strings default to `""`). Keep `QUESTIONNAIRE_VERSION` as the single version source. Apply a sane max-length guard per field to bound prompt size.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/cv/generate.ts` exports `prerender = false` and a `POST` handler.
- `src/lib/services/cv-generation.ts` exists and returns a `GenerateDraftResponse`; source search confirms no `console.log`/logging of raw answers, model responses, or draft content.
- Source search confirms the OpenAI call uses `fetch` (no Node-only SDK import) and an `AbortController` timeout is present.
- The route validates input with zod and checks `context.locals.user`.
- Lint passes: `npm run lint`; production build passes: `npm run build`.

#### Manual Verification:

- With a real key configured: `POST /api/cv/generate` with full answers returns a `GeneratedCvDraft` (`schemaVersion: 1`, all five section keys) in the selected language.
- Sparse answers (only name + goal) return a usable draft with `warnings` and no fabricated employers/schools/dates.
- Unauthenticated request returns 401 JSON; malformed body returns 400 `generation_failed`.
- With the key unset, the route returns `service_unavailable` and does not crash.
- A simulated slow/failed provider call surfaces `service_unavailable` within the timeout, not a hang.

**Implementation Note**: After this phase, pause for manual confirmation that real generation produces an honest, schema-valid draft (especially the no-fabrication behavior on sparse input) before wiring the UI.

---

## Phase 3: Questionnaire Generation UI

### Overview

Connect the existing review step to the generation endpoint: a real Generate action, honest loading, a minimal readable draft preview, and answer-preserving bucketed error handling.

### Changes Required:

#### 1. Generate action and request state

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Replace the disabled "Generation comes next" affordance with a real Generate action that submits the in-memory answers and tracks request status.

**Contract**: On the review step, render an enabled **Generate draft** button (only when required basics are valid). Add local state for status (`idle | loading | success | error`), the returned `GeneratedCvDraft`, and the current error bucket/message. Submit answers via `fetch("/api/cv/generate", { method: "POST", ... })` parsing `GenerateDraftResponse`. Keep all answers and the draft in component state only — no `localStorage`/`sessionStorage`/cookies/URL params, consistent with S-03.

#### 2. Loading feedback

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Satisfy FR-013 with honest progress feedback during the up-to-30s call.

**Contract**: While `loading`, show a spinner and calm status text (e.g. "Building your draft… this can take up to 30 seconds.") and disable the Generate/Back controls. No fake/animated progress milestones (F-01).

#### 3. Minimal draft preview

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Render the generated draft as a readable preview that proves generation works without building S-05's template or editing.

**Contract**: On `success`, replace the review with a read-only preview rendering all five sections (Summary, Experience, Education, Skills, Languages) plus `assumptions` and `warnings`, using the existing restrained slate/emerald styling. Include copy stating this is a draft and that the clean template + editing come next. Provide a way back to edit answers (re-generates on next submit). Do not add inline section editing, save, or export controls.

#### 4. Error and retry handling

**File**: `src/components/cv/QuestionnaireFlow.tsx`

**Intent**: Map failures to F-01 buckets and let the user recover without losing work.

**Contract**: On `error`, show the bucket's human-friendly message (`generation_failed` vs `service_unavailable`) and a **Retry** button that re-submits the same in-memory answers. Answers remain intact; the user can also go back to edit. No auto-retry.

#### 5. Page support copy

**File**: `src/pages/cv/new.astro`

**Intent**: Update the framing now that generation exists in this slice.

**Contract**: Revise the header/support copy so it no longer says "draft generation and saving come in later slices"; reflect that the user can now generate a draft, while saving and PDF export remain later slices. Do not promise save or export.

### Success Criteria:

#### Automated Verification:

- Source search confirms `QuestionnaireFlow.tsx` posts to `/api/cv/generate` and renders draft state from component state only (no `localStorage`/`sessionStorage`/cookies/URL params for answers or draft).
- The disabled "Generation comes next" button is gone; an enabled Generate action exists on review.
- Source search confirms no save/export/section-edit controls and no mock/hard-coded draft content were added to the component.
- Lint passes: `npm run lint`; production build passes: `npm run build`.

#### Manual Verification:

- Completing required basics enables Generate; pressing it shows the spinner + status, then the draft preview.
- The preview shows all five sections plus assumptions/warnings and clearly reads as a draft (not the final template).
- Sparse-input generation shows warnings and no fabricated facts in the preview.
- Inducing a failure (key unset or forced error) shows the correct bucket message and a Retry that preserves answers and succeeds once the cause is resolved.
- Editing answers after a draft and regenerating produces an updated draft; refreshing the page loses the in-memory draft (confirms no persistence).
- Layout is readable and non-overlapping on mobile and desktop.

**Implementation Note**: After this phase, pause for manual confirmation that the end-to-end generate → preview → retry flow is an acceptable S-04 stopping point before verification/closure.

---

## Phase 4: Verification And Change Metadata

### Overview

Run the repo gates, confirm scope did not leak into later slices, and update only this change's metadata. Does not flip roadmap status or sync the tracker.

### Changes Required:

#### 1. Astro type sync

**File**: `.astro/`

**Intent**: Regenerate Astro types if the new route/env changes require it.

**Contract**: Run `npx astro sync`. Treat generated type updates as verification output, not scope.

#### 2. Repository gates

**File**: `package.json`

**Intent**: Verify S-04 against the repo's existing gates.

**Contract**: Run `npm run lint` and `npm run build`. Do not introduce a new test runner.

#### 3. Scope-guard searches

**File**: `src/`

**Intent**: Confirm S-04 did not absorb persistence, export, editing-template, or logging-privacy violations.

**Contract**: Search source to confirm: no Supabase writes / `public.cvs` / saved-CV route; no PDF/export code; no S-05 clean template or section-editing controls; no raw-answer/model/draft logging; answers/draft are not persisted to browser storage. Remove anything out of scope unless explicitly approved.

#### 4. Change metadata and progress

**File**: `context/changes/generated-cv-draft/change.md`

**Intent**: Keep this change's state accurate during implementation.

**Contract**: Update `change.md` (`status`, `updated`) and the `## Progress` section of this plan per the 10x progress convention. Do not update `context/foundation/roadmap.md` to `done` until S-04 is reviewed and accepted.

### Success Criteria:

#### Automated Verification:

- Astro types sync successfully: `npx astro sync`.
- Lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Source search confirms no persistence, PDF/export, S-05 template/editing, or raw-answer logging was added.

#### Manual Verification:

- Signed-out users cannot call generation (401) and cannot reach `/cv/new`.
- A signed-in user can generate a draft from required basics and see the preview.
- Refreshing `/cv/new` loses the in-memory draft, confirming no persistence was added.
- `context/foundation/roadmap.md` remains unchanged by S-04 implementation.

**Implementation Note**: After this phase, pause for manual confirmation before treating S-04 as implemented or syncing roadmap/tracker status in a separate closure action.

---

## Testing Strategy

### Unit Tests:

- No unit test runner exists in this repo, and S-04 does not introduce one (consistent with S-03). The riskiest layer — schema conformance — is verified by validating the F-01 fixture against `generatedCvDraftSchema` as a manual/ad-hoc check during Phase 1.

### Integration Tests:

- Use current repository gates: `npx astro sync`, `npm run lint`, `npm run build`.
- Use source search to confirm S-04 did not add persistence, PDF/export, editing template, or raw-answer logging, and that the OpenAI call is `fetch`-based with a timeout.

### Manual Testing Steps:

1. Sign in, open `/cv/new`, and complete required basics (name + target/goal), choosing an output language.
2. Press Generate draft; confirm the spinner + honest status appears, then a draft preview.
3. Confirm the preview shows all five sections plus assumptions/warnings and reads as a draft, not the final template.
4. Generate from sparse input (skip optional sections); confirm warnings appear and no employers/schools/dates are fabricated.
5. Generate in Polish and Russian; confirm the draft content is in the selected language.
6. Unset the AI key (or force a provider error); confirm `service_unavailable`, then Retry after restoring the key succeeds.
7. Send a malformed/empty body to `/api/cv/generate`; confirm 400 `generation_failed`.
8. Call `/api/cv/generate` while signed out; confirm 401 JSON.
9. Edit answers after a draft and regenerate; confirm the draft updates.
10. Refresh `/cv/new`; confirm the in-memory draft is gone (no persistence).
11. Resize to mobile and desktop; confirm loading, preview, and error states are readable and non-overlapping.

## Performance Considerations

Generation is a single synchronous request targeting <30s (F-01). The service uses an `AbortController` (~25s) so slow calls fail as `service_unavailable` rather than hanging the Worker. Bound prompt size with per-field max-length guards on answers. Keep the client lightweight — one fetch, simple state, no polling/streaming/extra libraries.

## Migration Notes

No database migration. One new optional server secret (`OPENAI_API_KEY`, plus optional `OPENAI_MODEL`) must be added to local `.env`/`.dev.vars` and to Worker secrets for deployment (`wrangler secret put OPENAI_API_KEY`). Absent config degrades to `service_unavailable`, so build/deploy do not break without the key.

## References

- Roadmap S-04 slice: `context/foundation/roadmap.md:141`.
- F-01 output contract (shape/buckets/timeout/minimal-input): `context/changes/generation-export-decision-contract/decision-contract.md:31`, `:168`, `:189`, `:201`.
- F-01 reference fixture: `context/changes/generation-export-decision-contract/cv-contract.fixture.json:1`.
- S-03 input contract: `src/lib/cv-questionnaire.ts:1`; questionnaire island: `src/components/cv/QuestionnaireFlow.tsx:57`.
- API route pattern: `src/pages/api/auth/signin.ts:16`.
- Server-secret + graceful-unconfigured pattern: `astro.config.mjs:17`, `src/lib/supabase.ts:6`, `src/lib/config-status.ts:14`.
- Auth/user in middleware: `src/middleware.ts:4`.
- PRD requirements: `context/foundation/prd.md:66` (FR-006), `:78` (FR-012), `:80` (FR-013), `:82` (FR-014).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Draft Contract And Validation Foundation

#### Automated

- [x] 1.1 `zod` appears in `package.json` dependencies and `npm install` succeeds — 6720a81
- [x] 1.2 `src/types.ts` exports `GeneratedCvDraft` and all sub-types — 6720a81
- [x] 1.3 `src/lib/cv-draft.ts` exports `generatedCvDraftSchema`, `GenerationErrorBucket`, `GenerateDraftResponse`, and `z.infer` is assignable to `GeneratedCvDraft` — 6720a81
- [x] 1.4 `astro.config.mjs` declares `OPENAI_API_KEY` (and `OPENAI_MODEL` if added) in `env.schema` — 6720a81
- [x] 1.5 Type checking / lint passes: `npm run lint` — 6720a81

#### Manual

- [x] 1.6 Validating `cv-contract.fixture.json` against `generatedCvDraftSchema` succeeds — 6720a81
- [x] 1.7 A draft missing a section key or with an unknown warning code is rejected by the schema — 6720a81

### Phase 2: OpenAI Generation Service And API Route

#### Automated

- [x] 2.1 `src/pages/api/cv/generate.ts` exports `prerender = false` and a `POST` handler — 8b82d74
- [x] 2.2 `src/lib/services/cv-generation.ts` returns a `GenerateDraftResponse`; no logging of raw answers, model responses, or draft content — 8b82d74
- [x] 2.3 Source search confirms the OpenAI call uses `fetch` (no Node-only SDK) and an `AbortController` timeout is present — 8b82d74
- [x] 2.4 The route validates input with zod and checks `context.locals.user` — 8b82d74
- [x] 2.5 Lint passes: `npm run lint`; production build passes: `npm run build` — 8b82d74

#### Manual

- [x] 2.6 With a real key, full answers return a `GeneratedCvDraft` (`schemaVersion: 1`, all five section keys) in the selected language — 8b82d74
- [x] 2.7 Sparse answers return a usable draft with warnings and no fabricated employers/schools/dates — 8b82d74
- [x] 2.8 Unauthenticated request returns 401 JSON; malformed body returns 400 `generation_failed` — 8b82d74
- [x] 2.9 With the key unset, the route returns `service_unavailable` and does not crash — 8b82d74
- [x] 2.10 A simulated slow/failed provider call surfaces `service_unavailable` within the timeout, not a hang — 8b82d74

### Phase 3: Questionnaire Generation UI

#### Automated

- [x] 3.1 `QuestionnaireFlow.tsx` posts to `/api/cv/generate` and renders draft state from component state only (no browser storage / URL params) — ce7af68
- [x] 3.2 The disabled "Generation comes next" button is gone; an enabled Generate action exists on review — ce7af68
- [x] 3.3 Source search confirms no save/export/section-edit controls and no mock draft content were added — ce7af68
- [x] 3.4 Lint passes: `npm run lint`; production build passes: `npm run build` — ce7af68

#### Manual

- [x] 3.5 Completing required basics enables Generate; pressing it shows spinner + status, then the draft preview — ce7af68
- [x] 3.6 The preview shows all five sections plus assumptions/warnings and clearly reads as a draft — ce7af68
- [x] 3.7 Sparse-input generation shows warnings and no fabricated facts in the preview — ce7af68
- [x] 3.8 Inducing a failure shows the correct bucket message and a Retry that preserves answers and succeeds once resolved — ce7af68
- [x] 3.9 Editing answers and regenerating updates the draft; refreshing loses the in-memory draft — ce7af68
- [x] 3.10 Layout is readable and non-overlapping on mobile and desktop — ce7af68

### Phase 4: Verification And Change Metadata

#### Automated

- [x] 4.1 Astro types sync successfully: `npx astro sync`
- [x] 4.2 Lint passes: `npm run lint`
- [x] 4.3 Production build passes: `npm run build`
- [x] 4.4 Source search confirms no persistence, PDF/export, S-05 template/editing, or raw-answer logging was added

#### Manual

- [x] 4.5 Signed-out users cannot call generation (401) and cannot reach `/cv/new`
- [x] 4.6 A signed-in user can generate a draft from required basics and see the preview
- [x] 4.7 Refreshing `/cv/new` loses the in-memory draft, confirming no persistence
- [x] 4.8 `context/foundation/roadmap.md` remains unchanged by S-04 implementation
