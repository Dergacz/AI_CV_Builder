# Saved CV Library (S-06) Implementation Plan

## Overview

Roadmap slice **S-06 `saved-cv-library`** (PRD FR-009 *save changes* + FR-011 *access previous CVs*) lets a signed-in user save a generated/edited CV and reopen it later. This plan implements the already-decided **F-02 persistence/privacy contract** (`context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`) end-to-end: the first DB migration, a typed Supabase client, repository + API layer, save UI in the creation flow, a bookmarkable `/cv/[id]` reopen route, and a dashboard library with delete.

## Current State Analysis

- The generated draft lives **only in React state** in `QuestionnaireFlow` and is lost on reload — there is **no persistence layer at all**: no `supabase/migrations/`, no `cvs` table, no generated DB types (`src/db/` absent), and `createClient` in `src/lib/supabase.ts` is untyped.
- Supabase **is** initialized (`supabase/config.toml` exists), so `npx supabase start` works without `init`.
- The dashboard (`src/pages/dashboard.astro:64-67`) shows a literal placeholder: *"Saved CVs — Planned for the saved-library slice."*
- `/cv` is already auth-protected (`src/middleware.ts` `PROTECTED_ROUTES = ["/dashboard", "/cv"]`), so `/cv/[id]` inherits protection.
- Strong reusable foundations exist: `generatedCvDraftSchema`/`GeneratedCvDraft` (`src/lib/cv-draft.ts`), the API-route template (`src/pages/api/cv/generate.ts` — `prerender=false`, `json()` helper, auth gate, discriminated-union envelope, status mapping), per-request client (`src/lib/supabase.ts` + `signin.ts`), a focus-trapped confirm dialog (`CvEditor.tsx:222-304`), status/alert feedback (`QuestionnaireFlow.tsx:313-330`), and copy-module precedent (`cv-editor-copy.ts`, `cv-draft-messages.ts`).
- Test runner is vitest via `npm run test` (`= vitest run`); contract fixture `context/changes/generation-export-decision-contract/cv-contract.fixture.json` exists for schema tests.

### Key Discoveries

- **`source_snapshot.answers` is not inside the draft.** The draft's `source` field (`cv-draft.ts`) carries only `questionnaireVersion`/`generatedAt`/model info — **not** the questionnaire answers. Answers live separately as `CvQuestionnaireAnswers` in `QuestionnaireFlow` state and must be threaded explicitly into the save payload and restored on reopen (locked decision #1).
- **Contract SQL is fixed** (`persistence-privacy-contract.md:144-178`): `public.cvs` with `id`, `user_id` (FK `auth.users` on delete cascade), `title`, `language` (check `in ('en','pl','ru')`), `draft jsonb`, `source_snapshot jsonb`, `created_at`/`updated_at` (`not null default now()`); RLS enabled; four owner-only policies `auth.uid() is not null and auth.uid() = user_id`. Contract `:185` recommends an `updated_at` trigger if not set explicitly on every save → use the trigger.
- **Privacy boundaries are hard rules** (`:188-215`): never log raw `draft`, raw `source_snapshot.answers`, raw answers, generated text, prompt/model text, Supabase secrets, or stack traces in user-facing messages. Allowed: id, schemaVersion, questionnaireVersion, language, counts, warning codes, error buckets, timestamps.
- **API handoff rules** (`:223-230`): per-request `createClient`, null client → `service_unavailable`, verify with `supabase.auth.getUser()`, use that `user.id` as owner (never trust client), keep RLS active, explicit save semantics, hard delete.

## Desired End State

A signed-in user can: generate a CV → see a Save bar (default title `"{role} — {date}"`, editable) → save → see it on the dashboard library → open it at `/cv/[id]` → edit a section and save (updates same row) → delete it (with confirm). A second account can neither list nor GET the first account's CVs (RLS-enforced 404 / empty list). `npm run lint`, `npm run build`, and `npm run test` all pass.

## What We're NOT Doing

- **No edit-answers / regenerate from a reopened CV.** A reopened CV supports section-editing + save (update) + delete only; the regenerate path stays exclusive to fresh creation (`/cv/new`) — regenerating would discard edits, against the minimal-MVP guardrail.
- **No soft delete / retention columns** (contract: hard delete only).
- **No localization wiring** — copy stays English-only in dedicated modules so S-09 can localize later.
- **No pagination / search** on the library list (out of MVP scope).
- **No PDF/export changes** (separate slice).

## Implementation Approach

Build bottom-up so each phase is independently verifiable: data layer → types/schemas/services/copy → API routes → save UI in creation → reopen route → dashboard library + delete → tests. Reuse the `generate.ts` route template and existing draft schema throughout; the repository service centralizes typed queries and owner/`source_snapshot` assembly so no route trusts client-supplied identity. RLS is the load-bearing authorization guard; `getUser()` + `user.id` is the application-layer enforcement.

## Critical Implementation Details

- **Answers threading (decision #1).** `source_snapshot` is assembled server-side in the repository as `{ questionnaireVersion: QUESTIONNAIRE_VERSION, answers, capturedAt: new Date().toISOString() }`; the row's `language` mirrors `draft.language`. On reopen, the route passes `sourceSnapshot.answers` back into the island so a later regenerate (creation flow only) would have the original answers — but the reopen island hides that affordance.
- **Save identity (decision #4).** `useCvSave` holds `cvId` (undefined until first save). First save → POST `/api/cv` (INSERT), stores returned id; subsequent saves → PUT `/api/cv/[id]` (UPDATE same row). The reopen island pre-seeds `cvId` so its first save is already an UPDATE.
- **`updated_at` trigger.** The migration adds a `set_updated_at` trigger so the route never has to set it; keeps update writes honest.
- **Privacy in every route.** Log only the allowed diagnostic fields; user-facing failures carry a stable error bucket + plain message, never payloads or SQL/stack details.

## Phase 1 — Data Layer

### Overview

Author the first migration (table + RLS + trigger), generate typed DB types, and wire the `Database` generic into the shared client.

### Changes Required

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_cvs.sql` (first migration in the repo)

**Intent**: Create `public.cvs` exactly per the F-02 contract sketch, enable RLS with four owner-only policies, and add an `updated_at` trigger.

**Contract**: Table + columns + check constraint + FK per `persistence-privacy-contract.md:144-178` (`created_at`/`updated_at` `not null default now()`); `enable row level security`; four policies (select/insert/update/delete) gated on `auth.uid() is not null and auth.uid() = user_id`; a `before update` trigger setting `new.updated_at = now()`. Filename timestamp per the repo migration convention `YYYYMMDDHHmmss_short_description.sql`.

#### 2. Typed client + db scripts

**File**: `package.json`, `src/db/database.types.ts` (generated), `src/lib/supabase.ts`

**Intent**: Make all `.from("cvs")` calls type-checked.

**Contract**: Add scripts `"db:types": "supabase gen types typescript --local > src/db/database.types.ts"`, plus helpers `"db:start": "supabase start"`, `"db:reset": "supabase db reset"`. Generate `src/db/database.types.ts` against local Supabase (Docker; fall back to `--project-id` if Docker is unavailable). Change `createServerClient(...)` → `createServerClient<Database>(...)` in `src/lib/supabase.ts`, importing `Database` from `@/db/database.types`.

### Success Criteria

#### Automated Verification

- `npx supabase db reset` applies the migration cleanly (table + policies + trigger created).
- `npm run db:types` regenerates `src/db/database.types.ts` with a `cvs` row type.
- `npm run build` passes with the typed client (no type errors in `supabase.ts`).

#### Manual Verification

- In Supabase Studio, `public.cvs` exists with RLS enabled and four owner-only policies visible.
- An `updated_at` trigger is present and bumps the column on update.

**Implementation Note**: After this phase and all automated verification passes, pause for human confirmation of the manual DB checks before proceeding.

---

## Phase 2 — Types, Schemas, Services, Copy

### Overview

Define shared saved-CV types, extract/define zod schemas, build the typed repository service, and add English-only copy modules.

### Changes Required

#### 1. Shared types

**File**: `src/types.ts`

**Intent**: Provide the saved-CV entity/DTO types reused across API and UI.

**Contract**: `SourceSnapshot = { questionnaireVersion: string; answers: CvQuestionnaireAnswers; capturedAt: string }`; `SavedCvSummary = { id; title; language: CvOutputLanguage; createdAt; updatedAt }` (listing — no draft); `SavedCv = SavedCvSummary & { draft: GeneratedCvDraft; sourceSnapshot: SourceSnapshot }`. Reuse `GeneratedCvDraft`, `CvQuestionnaireAnswers`, `CvOutputLanguage`.

#### 2. Answers + save schemas

**File**: `src/lib/cv-answers.schema.ts` (new, server-only), `src/pages/api/cv/generate.ts` (import)

**Intent**: De-duplicate the answers schema and add the save-request schema, keeping zod out of client islands.

**Contract**: Move the inline `answersSchema` from `generate.ts:16-25` into the new module as `cvAnswersSchema` and import it back into `generate.ts`. Add `cvSaveSchema = { id: z.string().uuid().optional(), title: z.string().trim().min(1).max(200).optional(), draft: generatedCvDraftSchema, answers: cvAnswersSchema }` (reuse `generatedCvDraftSchema` from `@/lib/cv-draft`).

#### 3. Repository service

**File**: `src/lib/services/cv-repository.ts` (new)

**Intent**: Thin typed query functions (no HTTP) that centralize owner enforcement and `source_snapshot` assembly.

**Contract**: `listCvs(supabase, userId)`, `getCv(supabase, userId, id)`, `createCv(...)`, `updateCv(...)`, `deleteCv(...)`. Always set `user_id` from the verified user. Build `source_snapshot` = `{ questionnaireVersion: QUESTIONNAIRE_VERSION, answers, capturedAt: new Date().toISOString() }`; row `language` = `draft.language`. `listCvs` selects only `id,title,language,created_at,updated_at` ordered by `updated_at desc`.

#### 4. Default-title helper + copy modules

**File**: `src/lib/cv-library-copy.ts`, `src/lib/cv-save-messages.ts` (new); title helper colocated in the repository or copy module

**Intent**: Centralize the default title rule and all user-facing strings/error buckets, English-only, for later localization.

**Contract**: `defaultCvTitle(answers, date)` → trimmed/truncated (~60 chars) `targetRoleOrGoal` + ` — ` + `YYYY-MM-DD`; fallback to a `fullName`-based title when role is empty. `cv-library-copy.ts` — dashboard list, empty state, save bar, delete-dialog strings. `cv-save-messages.ts` — error buckets `save_failed | load_failed | delete_failed | not_found | service_unavailable` + a success string. Mirror `cv-editor-copy.ts` / `cv-draft-messages.ts` shape (zod-free).

### Success Criteria

#### Automated Verification

- `npm run build` passes (types + schemas + service compile; `generate.ts` still imports the extracted schema).
- `npm run lint` passes.

#### Manual Verification

- Repository functions read cleanly as the single owner-enforcement point (no client-supplied owner path).

---

## Phase 3 — API Routes

### Overview

Add the saved-CV REST routes mirroring `generate.ts` conventions.

### Changes Required

#### 1. Collection route

**File**: `src/pages/api/cv/index.ts` (new)

**Intent**: List the user's CVs and create new ones.

**Contract**: `export const prerender = false`; local `json(status, body)` helper; envelope `{ ok:true, ... } | { ok:false, error, message }`; auth gate via `context.locals.user`; per-request `createClient(context.request.headers, context.cookies)` (null → 503 `service_unavailable`); verify `supabase.auth.getUser()` and use that `user.id`. `GET` → `listCvs` → `{ ok:true, cvs: SavedCvSummary[] }`. `POST` → validate `cvSaveSchema`; `createCv` (INSERT) → `{ ok:true, cv: { id, title, ... } }`. Log only safe diagnostics.

#### 2. Item route

**File**: `src/pages/api/cv/[id].ts` (new)

**Intent**: Reopen, update, and delete a single CV.

**Contract**: Same envelope/auth/client conventions. `GET` → `getCv` → `{ ok:true, cv: SavedCv }`; missing/owned-by-other → 404 `not_found` (RLS returns no row). `PUT` → validate `cvSaveSchema`; `updateCv` (draft/source_snapshot/title/language; `updated_at` via trigger). `DELETE` → `deleteCv` (hard delete) → `{ ok:true }`.

### Success Criteria

#### Automated Verification

- `npm run build` passes (routes typecheck against the typed client).
- `npm run lint` passes.

#### Manual Verification

- `POST /api/cv` with a valid draft+answers returns `{ ok:true, cv:{ id } }` and inserts a row owned by the caller.
- `GET /api/cv` returns only the caller's summaries, newest first.
- `GET/PUT/DELETE /api/cv/[id]` behave correctly; a non-owner GET returns 404.
- No raw `draft`/`answers` appears in any server log or error response.

**Implementation Note**: Pause for human confirmation of the manual API checks (including the cross-account 404) before proceeding.

---

## Phase 4 — Save UI in the Creation Flow

### Overview

Add a Save bar to the editor and thread answers + a save controller through the questionnaire flow.

### Changes Required

#### 1. Save hook

**File**: `src/components/hooks/useCvSave.ts` (new)

**Intent**: Own save identity and status for the editor.

**Contract**: State `cvId` (undefined until first save), `title`, `status` (`idle|saving|saved|error`), `error`. `save(draft, answers)` POSTs `/api/cv` when no `cvId` (stores returned id → update mode), else PUTs `/api/cv/[id]`. Optional initializer to pre-seed `cvId`/`title` (used by the reopen island).

#### 2. Editor save bar

**File**: `src/components/cv/CvEditor.tsx`

**Intent**: Let the user title and save the CV with accessible feedback.

**Contract**: Add a save section — title `<input>` prefilled with `defaultCvTitle(...)` (editable), a **Save** button, `role="status"` success / `role="alert"` error feedback (reuse `QuestionnaireFlow.tsx:313-330` patterns). New props receive the save controller + `answers`. Make `onEditAnswers` **optional** (reopen flow hides it).

#### 3. Thread answers through the flow

**File**: `src/components/cv/QuestionnaireFlow.tsx` (around `:150-151`)

**Intent**: Supply the editor with answers and a save instance.

**Contract**: It already holds `answers` and `draft`; pass `answers` and a `useCvSave()` instance into `<CvEditor>`. After first save, the in-state `cvId` makes further saves UPDATE the same row.

### Success Criteria

#### Automated Verification

- `npm run build` and `npm run lint` pass.

#### Manual Verification

- After generation, a Save bar shows with an editable default title; Save inserts and switches to update mode (a second Save does not create a duplicate).
- Success/error feedback is announced (status/alert roles).

---

## Phase 5 — Reopen Route `/cv/[id]`

### Overview

Server-render a saved CV into an editor island that saves as an update.

### Changes Required

#### 1. Reopen page

**File**: `src/pages/cv/[id].astro` (new, already under protected `/cv`)

**Intent**: Load the owned CV server-side and hydrate the editor.

**Contract**: Server-side `createClient(Astro.request.headers, Astro.cookies)` + `getUser`; `getCv(supabase, user.id, id)`; not found → redirect `/dashboard`. Pass `draft`, `sourceSnapshot.answers`, `id`, `title` into the island.

#### 2. Reopen island

**File**: `src/components/cv/SavedCvView.tsx` (new, `client:load`)

**Intent**: Reuse the editor for an existing CV in update mode.

**Contract**: Hydrate from props; set up `useCvDraftEditor` + `useCvSave` pre-seeded with `cvId` (→ UPDATE mode); render `<CvEditor>` with `onEditAnswers` omitted (regenerate affordance hidden). Section edits + Save (update) work identically to creation.

### Success Criteria

#### Automated Verification

- `npm run build` and `npm run lint` pass.

#### Manual Verification

- Opening `/cv/[id]` for an owned CV renders the saved draft; editing a section + Save persists; reopening shows the edit.
- Opening a non-owned/nonexistent id redirects to `/dashboard`.
- The edit-answers / regenerate affordance is absent on this route.

---

## Phase 6 — Dashboard Library + Delete

### Overview

Replace the dashboard placeholder with a real library list and wire delete via the extracted confirm dialog.

### Changes Required

#### 1. Extract confirm dialog

**File**: `src/components/cv/ConfirmDialog.tsx` (new), `src/components/cv/CvEditor.tsx` (consume)

**Intent**: Reuse the focus-trapped dialog for both the regenerate guard and delete.

**Contract**: Extract `ConfirmDiscardDialog` from `CvEditor.tsx:222-304` into `ConfirmDialog` with props for title/body/confirm/cancel labels + handlers (preserve focus trap + Escape). `CvEditor`'s regenerate guard consumes it.

#### 2. Dashboard list

**File**: `src/pages/dashboard.astro` (replace `:64-67`)

**Intent**: Show the user's saved CVs.

**Contract**: Server-side `createClient(Astro.request.headers, Astro.cookies)` + `listCvs`; pass summaries to `<SavedCvList client:load cvs={...} />`. Keep the "Start CV" CTA → `/cv/new`.

#### 3. Library island

**File**: `src/components/cv/SavedCvList.tsx` (new)

**Intent**: Render summary cards with open + delete.

**Contract**: Cards (title, language, `updatedAt`) each with **Open** (anchor → `/cv/[id]`) and **Delete** (opens `ConfirmDialog` → `DELETE /api/cv/[id]` → optimistic removal; `role="alert"` on failure). Empty state when no CVs.

### Success Criteria

#### Automated Verification

- `npm run build` and `npm run lint` pass.

#### Manual Verification

- Dashboard lists saved CVs newest-first; empty state shows when none exist.
- Open navigates to `/cv/[id]`; Delete confirms then removes the card and the row.
- Failed delete surfaces an alert and leaves the card in place.

---

## Testing Strategy

### Unit Tests (vitest, `npm run test`)

- `cvSaveSchema` / `cvAnswersSchema`: accept the contract fixture `context/changes/generation-export-decision-contract/cv-contract.fixture.json`; reject malformed payloads.
- `defaultCvTitle`: truncation (~60 chars) and `fullName` fallback when role is empty.
- `source_snapshot` assembly: `language` mirrors `draft.language`; `questionnaireVersion` = `QUESTIONNAIRE_VERSION`.

### Manual Testing Steps

1. `npx supabase start` → `npm run db:reset` → `npm run db:types` → `npm run dev`.
2. Sign in → generate → Save (default title) → confirm it appears on the dashboard.
3. Open `/cv/[id]` → edit a section → Save → reopen → verify the edit persisted.
4. Delete from the dashboard → confirm it disappears and the row is gone.
5. **RLS check**: with a second account, confirm `GET /api/cv` returns none of account 1's rows and `GET /api/cv/[id]` for account 1's id returns 404.

### Gates

- `npm run lint`, `npm run build`, `npm run test` all pass.

## Performance Considerations

The library list query selects only listable columns (`id,title,language,created_at,updated_at`) and never loads `draft`/`source_snapshot` JSON, keeping the dashboard fetch light per the contract's "keep listable fields outside JSON" guidance.

## Migration Notes

This is the **first** migration in the repo; Supabase is already initialized (`supabase/config.toml` present). Generated types land at `src/db/database.types.ts` (committing generated types is fine for a typed client). If Docker is unavailable locally, generate types against the linked project via `--project-id` instead of `--local`.

## References

- Research: `context/changes/saved-cv-library/research.md`
- Governing contract: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md` (SQL `:144-178`, logging `:188-215`, API handoff `:217-232`)
- API route template: `src/pages/api/cv/generate.ts`
- Draft schema (single source of truth): `src/lib/cv-draft.ts`
- Confirm dialog to extract: `src/components/cv/CvEditor.tsx:222-304`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Layer

#### Automated

- [x] 1.1 `npx supabase db reset` applies the migration cleanly — 92760cc
- [x] 1.2 `npm run db:types` regenerates `src/db/database.types.ts` with a `cvs` row type — 92760cc
- [x] 1.3 `npm run build` passes with the typed client — 92760cc

#### Manual

- [x] 1.4 `public.cvs` exists with RLS + four owner-only policies — 92760cc
- [x] 1.5 `updated_at` trigger present and bumps on update — 92760cc

### Phase 2: Types, Schemas, Services, Copy

#### Automated

- [x] 2.1 `npm run build` passes (types/schemas/service; `generate.ts` imports extracted schema)
- [x] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Repository is the single owner-enforcement point (no client-supplied owner path)

### Phase 3: API Routes

#### Automated

- [ ] 3.1 `npm run build` passes (routes typecheck against typed client)
- [ ] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 `POST /api/cv` inserts an owned row; returns `{ ok:true, cv:{ id } }`
- [ ] 3.4 `GET /api/cv` returns only the caller's summaries, newest first
- [ ] 3.5 `GET/PUT/DELETE /api/cv/[id]` correct; non-owner GET → 404
- [ ] 3.6 No raw `draft`/`answers` in logs or error responses

### Phase 4: Save UI in the Creation Flow

#### Automated

- [ ] 4.1 `npm run build` and `npm run lint` pass

#### Manual

- [ ] 4.2 Save bar with editable default title; Save inserts then switches to update mode (no duplicate)
- [ ] 4.3 Success/error feedback announced via status/alert roles

### Phase 5: Reopen Route `/cv/[id]`

#### Automated

- [ ] 5.1 `npm run build` and `npm run lint` pass

#### Manual

- [ ] 5.2 Owned CV renders; section edit + Save persists across reopen
- [ ] 5.3 Non-owned/nonexistent id redirects to `/dashboard`
- [ ] 5.4 Regenerate / edit-answers affordance absent on this route

### Phase 6: Dashboard Library + Delete

#### Automated

- [ ] 6.1 `npm run build` and `npm run lint` pass

#### Manual

- [ ] 6.2 Dashboard lists CVs newest-first; empty state when none
- [ ] 6.3 Open navigates to `/cv/[id]`; Delete confirms then removes card + row
- [ ] 6.4 Failed delete surfaces alert, card remains

### Testing & Gates

#### Automated

- [ ] T.1 Unit tests pass: schema accept/reject, `defaultCvTitle`, `source_snapshot` assembly
- [ ] T.2 `npm run lint`, `npm run build`, `npm run test` all pass

#### Manual

- [ ] T.3 Full E2E walkthrough (generate → save → reopen → edit → delete)
- [ ] T.4 RLS cross-account isolation verified (empty list + 404)
