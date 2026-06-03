# CV Persistence Privacy Contract - Plan Brief

> Full plan: `context/changes/cv-persistence-privacy-contract/plan.md`

## What & Why

This plan defines the minimal owner-only saved-CV persistence contract for AI CV Builder. F-02 exists because saved CV library and the full saved PDF flow need a shared data/privacy model before implementation starts.

## Starting Point

The app already has Supabase auth, an SSR Supabase helper, middleware-protected routes, and a basic authenticated dashboard. It does not yet have CV tables, migrations, generated DB types, product CV routes, saved CV UI, or persistence behavior.

## Desired End State

Future slices can rely on one contract artifact for saved CV row shape, owner-only RLS, explicit-save overwrite behavior, hard delete semantics, safe logging rules, and S-06/S-08 handoff criteria. The change also provides a representative SQL sketch so S-06 can plan a production migration without re-asking the ownership model.

## Key Decisions Made

| Decision         | Choice                                          | Why                                                                                  |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Persisted shape  | Full `GeneratedCvDraft` JSON snapshot           | Fastest path that preserves F-01 shape for editing, saving, and export.              |
| Source data      | Minimal questionnaire source snapshot           | Keeps provenance for future regeneration/debugging while limiting private retention. |
| Ownership        | `user_id` owner column plus strict RLS          | Database-level privacy is stronger than relying only on route filters.               |
| Save semantics   | Explicit save overwrites current draft row      | Predictable MVP behavior without autosave, revisions, or conflict handling.          |
| Listing metadata | `title`, `language`, `created_at`, `updated_at` | Enough for a minimal library without querying inside JSON.                           |
| Delete behavior  | Hard delete CV row                              | Clear privacy behavior and no retained soft-deleted CV content.                      |
| Logging          | No raw CV/questionnaire data in logs            | CV content is sensitive and should not leak through diagnostics.                     |
| Artifact scope   | Decision contract plus SQL sketch               | Unblocks S-06 planning without prematurely adding migrations.                        |

## Scope

**In scope:**

- `persistence-privacy-contract.md` with saved CV shape, privacy, retention, and handoff decisions.
- Representative `public.cvs` SQL sketch.
- Owner-only RLS policy sketch for select, insert, update, and delete.
- Roadmap handoff update after implementation.
- Verification through Prettier, `npx astro sync`, `npm run lint`, and `npm run build`.

**Out of scope:**

- Production Supabase migration and generated database types.
- Save/reopen/list/delete API routes.
- Saved CV dashboard UI.
- Autosave, revision history, sharing, workspaces, collaboration, exported PDF storage, queues, or broad data abstractions.

## Architecture / Approach

Keep the contract in `context/changes/cv-persistence-privacy-contract/` until S-06 is ready to create production schema and routes. The canonical saved CV is one owner-owned `cvs` row with listing metadata, a `GeneratedCvDraft` JSON snapshot, and a minimal source snapshot; access is protected by Supabase RLS using `auth.uid()` against `user_id`.

## Phases at a Glance

| Phase                       | What it delivers                                     | Key risk                                              |
| --------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| 1. Persistence Contract     | Saved CV shape, save/delete semantics, logging rules | Contract grows into implementation detail             |
| 2. RLS And SQL Sketch       | Representative table and owner-only policy sketch    | RLS sketch is too vague for privacy-critical planning |
| 3. Verification And Handoff | Repo gates, roadmap update, downstream handoff notes | Roadmap implies S-06/S-08 are implemented             |

**Prerequisites:** Existing PRD, roadmap, F-01 generation/export contract, and current Supabase auth baseline.
**Estimated effort:** About 1 implementation session across 3 small phases.

## Open Risks & Assumptions

- The JSON snapshot approach is intentionally less queryable than normalized sections, but that is acceptable for MVP speed.
- S-06 must still turn the representative SQL into a production migration and verify owner/non-owner RLS behavior.
- The source snapshot stores private questionnaire data, so implementation must keep logging and deletion behavior strict.

## Success Criteria (Summary)

- Future S-06 planning can reuse the saved CV shape and owner privacy model without re-asking F-02 questions.
- Future S-08 planning can rely on language preservation through saved CV state.
- The change remains a foundation decision artifact and does not add production persistence code early.
