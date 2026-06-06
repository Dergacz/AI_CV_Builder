# Saved CV Library (S-06) — Plan Brief

> Full plan: `context/changes/saved-cv-library/plan.md`
> Research: `context/changes/saved-cv-library/research.md`

## What & Why

Roadmap slice **S-06** (PRD FR-009 *save changes* + FR-011 *access previous CVs*) lets a signed-in user save a generated/edited CV and reopen it later. Today the draft lives only in React state and is lost on reload — there is no persistence at all. This plan implements the already-decided F-02 persistence/privacy contract end-to-end.

## Starting Point

No data layer exists: no migrations, no `cvs` table, no generated DB types, untyped Supabase client. The dashboard shows a literal "Saved CVs — Planned for the saved-library slice" placeholder. Strong reusable scaffolding is already in place (`generatedCvDraftSchema`, the `generate.ts` route template, per-request client, a focus-trapped confirm dialog, status/alert patterns, copy-module precedent), and `/cv` is already auth-protected.

## Desired End State

A user can generate a CV, save it (editable default title `"{role} — {date}"`), see it in a dashboard library, reopen it at a bookmarkable `/cv/[id]`, edit a section and re-save (same row), and delete it with confirmation. RLS guarantees a second account sees none of the first's CVs. Lint, build, and tests all pass.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Answers persistence | Thread `CvQuestionnaireAnswers` into `source_snapshot.answers`; restore on reopen | Answers live outside the draft; needed to fully reconstruct a CV | Research/User |
| Typed client | Generate DB types right after the first migration | Type-checks all `.from("cvs")` calls upfront | User |
| Reopen route | New `/cv/[id]` page | Bookmarkable; keeps `/cv/new` creation-only | User |
| Save identity | Carry `cvId` in editor state → INSERT first, UPDATE after | Simple explicit-save semantics, no duplicates | User |
| Delete in v1 | Include it, reusing the existing confirm dialog | Dialog already built — nearly free | User |
| Reopen scope | Section-edit + save + delete only (no regenerate) | Regenerate would discard edits — against minimal-MVP guardrail | Plan |
| `updated_at` | DB trigger, not route-set | Keeps update writes honest | Plan |

## Scope

**In scope:** first migration (table + RLS + trigger), typed client, repository service, save/list/get/update/delete API routes, save UI in creation flow, `/cv/[id]` reopen route, dashboard library list + delete, unit tests.

**Out of scope:** edit-answers/regenerate from a reopened CV, soft delete, localization wiring, list pagination/search, PDF/export changes.

## Architecture / Approach

Bottom-up, phase-by-phase: **data layer → types/schemas/services/copy → API routes → save UI → reopen route → dashboard + delete → tests.** A repository service (`cv-repository.ts`) centralizes typed queries, owner enforcement (`user.id` from `getUser()`, never client), and `source_snapshot` assembly. RLS is the load-bearing authorization guard. All routes mirror the existing `generate.ts` envelope/auth conventions and respect the contract's hard privacy rules (no raw payloads in logs or errors).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | Migration + RLS + trigger, typed client, db scripts | Needs Docker for `--local` type gen (fallback: `--project-id`) |
| 2. Types/schemas/services/copy | Shared types, extracted answers + save schemas, repository, copy | Schema drift if `generate.ts` not switched to the extracted schema |
| 3. API routes | `/api/cv` + `/api/cv/[id]` CRUD with envelope + auth | Accidentally logging raw `draft`/`answers` |
| 4. Save UI | `useCvSave` + save bar threaded through the flow | INSERT-vs-UPDATE identity bug → duplicate rows |
| 5. Reopen route | `/cv/[id]` page + `SavedCvView` island | Restoring answers without exposing regenerate |
| 6. Dashboard + delete | Extracted `ConfirmDialog`, library list island | Optimistic delete vs failure handling |
| 7. Tests & gates | Schema/title/snapshot unit tests + E2E + RLS check | — |

**Prerequisites:** F-02 contract (done), S-02 account access (done); local Supabase + Docker for migration/type-gen.
**Estimated effort:** ~3–5 sessions across 7 phases.

## Open Risks & Assumptions

- Type generation assumes Docker is available locally; documented `--project-id` fallback if not.
- Assumes the existing draft schema (`generatedCvDraftSchema`) is stable as the persisted `draft` shape.
- This is the repo's first migration — applying it cleanly against a fresh local DB is the gating step for everything downstream.

## Success Criteria (Summary)

- A user can save, reopen, edit-and-resave, and delete a CV through the UI.
- A second account can never list or fetch another user's CVs (RLS-enforced empty list / 404).
- `npm run lint`, `npm run build`, and `npm run test` all pass; no raw CV payloads ever logged.
