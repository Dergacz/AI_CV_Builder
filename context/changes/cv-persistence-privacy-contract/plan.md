# CV Persistence Privacy Contract Implementation Plan

## Overview

Define the minimal saved-CV persistence and privacy contract that unblocks `S-06` saved CV library and `S-08` full saved PDF flow. This change produces durable planning artifacts only: a persistence/privacy decision contract with a representative SQL/RLS sketch and handoff notes for downstream implementation.

## Current State Analysis

The roadmap marks `cv-persistence-privacy-contract` as F-02: a foundation slice whose outcome is defining owner-only saved-CV persistence enough to plan save/reopen behavior without building a broad data layer in advance. The app already has Supabase auth, Astro middleware, server-side Supabase client creation, and an authenticated dashboard route, but it has no CV tables, Supabase migrations, generated database types, product CV routes, save/reopen UI, or CV library behavior.

F-01 already defines the generated CV draft as strict structured JSON with `schemaVersion: 1`, a selected output language, source metadata, five editable sections, assumptions, and warnings. F-02 should preserve that shape as the saved CV payload instead of normalizing individual sections before the MVP has a real need for per-section queries.

Context7 checks against current Supabase docs confirmed that owner-only private data should be protected with row level security policies based on the authenticated user's `auth.uid()`, and that server-side routes should use a per-request SSR client plus verified `auth.getUser()` for authorization-sensitive work.

## Desired End State

After this plan is implemented, future slices can reference one contract artifact for:

- the smallest saved CV row shape,
- the owner-only privacy boundary,
- explicit-save overwrite behavior,
- hard delete retention behavior,
- safe logging and diagnostics rules,
- representative Supabase SQL/RLS policy shape,
- S-06 and S-08 handoff criteria.

Verification succeeds when the contract artifact exists, the representative SQL sketch covers table fields and policies, the roadmap can point to F-02 as completed, and the current repo gates still pass.

### Key Discoveries:

- F-02 is explicitly a foundation contract that unlocks S-06 and S-08: `context/foundation/roadmap.md:81`.
- The roadmap's baseline says auth exists, product APIs are partial, and there are no CV tables or migrations yet: `context/foundation/roadmap.md:58`.
- F-01 already defines the structured `GeneratedCvDraft` shape that persistence should preserve: `context/changes/generation-export-decision-contract/decision-contract.md:26`.
- F-01 explicitly deferred CV persistence schema to F-02: `context/changes/generation-export-decision-contract/decision-contract.md:269`.
- The existing Supabase helper creates a per-request server client with request cookies: `src/lib/supabase.ts:5`.
- The existing middleware uses `supabase.auth.getUser()` and protects routes through `PROTECTED_ROUTES`: `src/middleware.ts:6`.
- The repo has the Supabase CLI dependency but only `supabase/config.toml`; there are no migrations yet: `package.json:52`.

## What We're NOT Doing

- Adding a production Supabase migration.
- Generating database types.
- Building save, update, delete, or list API routes.
- Building the saved CV dashboard/library UI.
- Building generated CV draft, section editing, or PDF export behavior.
- Adding revision history, autosave, collaboration, sharing, workspaces, or team ownership.
- Persisting exported PDF files.
- Adding storage buckets, background jobs, queues, analytics pipelines, or app-wide data abstractions.
- Logging raw CV content or questionnaire answers.
- Writing to `context/archive/`.

## Implementation Approach

Keep F-02 as a foundation decision contract in `context/changes/cv-persistence-privacy-contract/`. The contract chooses one `cvs` row per saved CV, owned by `user_id`, with simple listing metadata and two JSON payloads: the full generated/edited CV draft snapshot and a minimal source snapshot of questionnaire inputs used for generation.

The privacy contract is database-first: every saved CV row belongs to `auth.users.id`, row level security is enabled immediately, and select/insert/update/delete policies require the authenticated user to own the row. Server routes planned later in S-06 still verify identity through the current SSR Supabase pattern, but route checks are not the only privacy boundary.

The MVP save model is explicit overwrite. A user saves the current draft snapshot into the same row; the contract does not add autosave, revisions, merge conflict handling, or undo. Deletion is a hard delete of the saved CV row and its source snapshot so the privacy behavior is clear.

## Critical Implementation Details

### Privacy Boundary

Route-level checks are useful but not sufficient for this change. The contract must make row level security the load-bearing privacy guarantee so future S-06 API routes cannot accidentally expose another user's CV through a missing filter.

### Data Minimization

The source snapshot is intentionally minimal: it exists to preserve provenance and support future regeneration/debugging, but it should not become a general event log or analytics payload. The contract must also state that logs may include IDs, schema versions, counts, and error buckets, but not raw questionnaire answers or CV content.

## Phase 1: Persistence Contract

### Overview

Create the durable decision contract that fixes the saved CV shape, metadata fields, save semantics, retention behavior, and downstream handoff rules.

### Changes Required:

#### 1. Persistence and privacy decision contract

**File**: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`

**Intent**: Define the minimal owner-only saved CV contract that S-06 can turn into production schema, routes, and dashboard behavior.

**Contract**: The document must include sections for:

- purpose and downstream consumers,
- decision summary,
- saved CV row shape,
- `GeneratedCvDraft` payload preservation,
- minimal source snapshot,
- listing metadata,
- explicit-save overwrite behavior,
- hard delete retention behavior,
- privacy and RLS boundary,
- logging and diagnostics rules,
- out-of-scope items,
- downstream handoff map.

#### 2. Saved CV payload rules

**File**: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`

**Intent**: Make the contract compatible with F-01 while avoiding premature normalized section storage.

**Contract**: The saved CV payload must preserve one full `GeneratedCvDraft` JSON snapshot with `schemaVersion`, `language`, `source`, `sections`, `assumptions`, and `warnings`. The source snapshot must store only the questionnaire version and submitted answers used for generation, not a broader event stream.

#### 3. Save, list, and delete semantics

**File**: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`

**Intent**: Fix the MVP user-visible behavior that downstream implementation should plan against.

**Contract**: The contract must state that S-06 uses explicit save, overwrites the current row's draft snapshot, lists saved CVs by `title`, `language`, `created_at`, and `updated_at`, and hard-deletes the row when a user deletes a saved CV.

### Success Criteria:

#### Automated Verification:

- Contract artifact exists at `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`.
- Contract artifact passes Prettier check with `npx prettier --check context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`.
- Contract artifact contains required headings for saved CV shape, source snapshot, ownership/RLS, save semantics, delete semantics, logging rules, and downstream handoff.

#### Manual Verification:

- Contract answers the F-02 roadmap unknown without introducing production migrations.
- Contract stays inside the PRD scope and does not add autosave, revisions, sharing, exported PDF storage, or a broad data layer.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the saved CV behavior is the intended MVP behavior before proceeding to the SQL/RLS sketch.

---

## Phase 2: RLS And SQL Sketch

### Overview

Add a representative Supabase table and policy sketch that makes the owner-only privacy boundary concrete without committing production migrations in F-02.

### Changes Required:

#### 1. Representative table sketch

**File**: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`

**Intent**: Give S-06 a concrete starting point for a future migration while keeping this change as a decision artifact.

**Contract**: The SQL sketch must represent one `public.cvs` table with:

- `id`,
- `user_id` referencing `auth.users(id)`,
- `title`,
- `language` constrained to `en`, `pl`, or `ru`,
- `draft` JSON payload,
- `source_snapshot` JSON payload,
- `created_at`,
- `updated_at`.

The sketch should describe desired constraints in prose when a full production constraint would be too detailed for this contract.

#### 2. Owner-only policy sketch

**File**: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`

**Intent**: Make database-level privacy non-optional for downstream implementation.

**Contract**: The SQL sketch must enable row level security and show separate owner-only select, insert, update, and delete policies using `auth.uid() IS NOT NULL` and ownership equality against `user_id`. Insert and update must include ownership checks that prevent writing rows for another user.

#### 3. API handoff rules

**File**: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`

**Intent**: Align future S-06 routes with existing Astro/Supabase auth patterns.

**Contract**: The handoff must state that future API routes use the existing per-request `createClient()` helper, verify identity with `auth.getUser()` for authorization-sensitive work, and return user-facing failures without exposing raw payloads, provider details, secret names, or stack traces.

### Success Criteria:

#### Automated Verification:

- Contract artifact includes a representative SQL sketch for `public.cvs`.
- Contract artifact includes RLS enablement and select, insert, update, and delete policy sketches.
- Contract artifact includes API handoff rules for S-06.
- Changed markdown passes Prettier check with `npx prettier --check context/changes/cv-persistence-privacy-contract`.

#### Manual Verification:

- SQL sketch is specific enough for S-06 to write a migration without re-asking the ownership model.
- RLS rules make owner-only access the database-level privacy boundary.
- SQL remains clearly marked as representative, not a production migration.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the RLS sketch is strict enough for the privacy requirement.

---

## Phase 3: Verification And Handoff

### Overview

Validate the artifacts, update roadmap handoff state, and make F-02 ready for saved-library planning.

### Changes Required:

#### 1. Downstream handoff notes

**File**: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`

**Intent**: Tell future `/10x-plan` runs exactly which decisions to reuse.

**Contract**: The handoff section must map contract sections to downstream slices: S-06 saved CV library and S-08 full saved PDF flow. It should also name F-01 files that future agents should load first when persistence must preserve generated draft shape.

#### 2. Roadmap status update

**File**: `context/foundation/roadmap.md`

**Intent**: Keep the living roadmap aligned once F-02 is implemented.

**Contract**: Implementation should mark F-02 as done, remove or resolve its F-02 unknown in the relevant place, and add a Done note pointing to `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`. It must not claim S-06 or S-08 are implemented.

#### 3. Change identity status

**File**: `context/changes/cv-persistence-privacy-contract/change.md`

**Intent**: Keep the change identity current as planning and implementation progress.

**Contract**: This planning step sets `status: planned` and `updated: 2026-06-03`. Implementation status changes remain governed by `/10x-implement` and must not write to `context/archive/`.

### Success Criteria:

#### Automated Verification:

- `npx astro sync` completes.
- `npm run lint` completes.
- `npm run build` completes.
- `npx prettier --check context/changes/cv-persistence-privacy-contract context/foundation/roadmap.md` completes.

#### Manual Verification:

- Future S-06 planning can reuse the saved CV shape, save semantics, owner privacy model, and SQL/RLS sketch without asking the same F-02 questions again.
- Future S-08 planning can rely on saved CV language preservation through generation, editing, saving, and export.
- The contract reads as a decision artifact, not as premature production implementation.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that F-02 is ready to unblock saved CV library planning.

---

## Testing Strategy

### Unit Tests:

- No test runner is configured, so do not invent unit tests in this change.
- Use Prettier checks for markdown artifact formatting.
- Use text checks to confirm the contract includes the required sections and RLS policy names.

### Integration Tests:

- No product integration exists yet because save/reopen routes are out of scope.
- Use `npx astro sync`, `npm run lint`, and `npm run build` as the current repo gates.

### Manual Testing Steps:

1. Read `persistence-privacy-contract.md` and confirm it answers the F-02 roadmap unknown.
2. Confirm the contract preserves F-01's `GeneratedCvDraft` shape instead of replacing it with normalized sections.
3. Confirm the SQL sketch includes owner-only RLS for select, insert, update, and delete.
4. Confirm the contract explicitly rejects raw CV/questionnaire data in logs.
5. Confirm the roadmap update marks only F-02 as done and does not unblock S-06/S-08 beyond planning readiness.

## Performance Considerations

The chosen JSON snapshot approach optimizes for MVP speed and avoids section-level query complexity. Listing uses top-level metadata (`title`, `language`, `created_at`, `updated_at`) so the saved CV library does not need to scan inside the draft JSON for basic dashboard rendering.

## Migration Notes

No production migration is part of this change. S-06 should turn the representative SQL sketch into a real Supabase migration, generate database types if that becomes part of the local convention, and verify RLS with at least owner and non-owner access scenarios.

## References

- Roadmap F-02: `context/foundation/roadmap.md:81`
- Roadmap baseline: `context/foundation/roadmap.md:58`
- PRD privacy and retention requirements: `context/foundation/prd.md`
- F-01 generated draft contract: `context/changes/generation-export-decision-contract/decision-contract.md:26`
- F-01 persistence deferral: `context/changes/generation-export-decision-contract/decision-contract.md:269`
- Supabase server client helper: `src/lib/supabase.ts:5`
- Auth middleware and route protection: `src/middleware.ts:6`
- Current package baseline: `package.json:21`
- Supabase RLS docs checked through Context7: `https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx`
- Supabase SSR docs checked through Context7: `https://github.com/supabase/ssr/blob/main/_autodocs/api-reference/createServerClient.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Persistence Contract

#### Automated

- [x] 1.1 Contract artifact exists — f18d171
- [x] 1.2 Contract artifact passes Prettier check — f18d171
- [x] 1.3 Contract artifact contains required headings — f18d171

#### Manual

- [x] 1.4 Contract answers the F-02 roadmap unknown — f18d171
- [x] 1.5 Contract stays inside PRD scope — f18d171

### Phase 2: RLS And SQL Sketch

#### Automated

- [x] 2.1 Contract includes public.cvs SQL sketch
- [x] 2.2 Contract includes owner-only RLS policy sketches
- [x] 2.3 Contract includes S-06 API handoff rules
- [x] 2.4 Changed markdown passes Prettier check

#### Manual

- [x] 2.5 SQL sketch is specific enough for S-06 migration planning
- [x] 2.6 RLS rules make owner-only access the database privacy boundary
- [x] 2.7 SQL remains marked as representative

### Phase 3: Verification And Handoff

#### Automated

- [ ] 3.1 Astro sync completes
- [ ] 3.2 Lint completes
- [ ] 3.3 Build completes
- [ ] 3.4 Change-folder and roadmap Prettier check completes

#### Manual

- [ ] 3.5 S-06 planning can reuse the persistence contract
- [ ] 3.6 S-08 planning can reuse language preservation rules
- [ ] 3.7 Contract remains a decision artifact
