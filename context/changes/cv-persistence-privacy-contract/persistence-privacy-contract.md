# CV Persistence And Privacy Contract

## Purpose

This contract resolves roadmap item F-02 for AI CV Builder. It defines the minimum owner-only saved-CV persistence model needed before planning:

- S-06 saved CV library,
- S-08 full saved PDF flow.

It is a decision artifact, not production implementation. It does not add a Supabase migration, generated database types, API routes, dashboard UI, storage buckets, background jobs, or a broader data layer.

## Decision Summary

| Area             | Decision                                              | Downstream consumer |
| ---------------- | ----------------------------------------------------- | ------------------- |
| Persisted shape  | One owner-owned saved CV row with JSON snapshots      | S-06, S-08          |
| Draft payload    | Preserve the full F-01 `GeneratedCvDraft` shape       | S-06, S-07, S-08    |
| Source snapshot  | Store minimal questionnaire provenance                | S-04, S-06          |
| Listing metadata | Store `title`, `language`, `created_at`, `updated_at` | S-06                |
| Save behavior    | Explicit save overwrites the current draft row        | S-05, S-06          |
| Delete behavior  | Hard delete the saved CV row                          | S-06                |
| Privacy boundary | `user_id` owner column plus strict RLS                | S-06                |
| Diagnostics      | No raw CV or questionnaire payloads in logs           | S-04, S-06, S-07    |

## Saved CV Row Shape

The future S-06 migration should model saved CVs as one `public.cvs` row per saved CV. The row stores listable metadata outside the draft JSON and keeps CV content inside the structured payload.

Minimum row fields:

- `id` - saved CV identifier.
- `user_id` - owner identifier referencing `auth.users.id`.
- `title` - user-visible saved CV name or app-generated default title.
- `language` - selected CV output language: `en`, `pl`, or `ru`.
- `draft` - full generated or edited CV draft JSON snapshot.
- `source_snapshot` - minimal questionnaire provenance used to create the current draft.
- `created_at` - row creation timestamp.
- `updated_at` - last explicit save timestamp.

The row shape is intentionally not normalized into per-section tables for the MVP. S-06 needs save, list, reopen, and delete behavior; it does not need section-level reporting, search, collaboration, history, or analytics queries.

## GeneratedCvDraft Payload Preservation

The `draft` payload must preserve the F-01 `GeneratedCvDraft` contract:

- `schemaVersion`,
- `language`,
- `source`,
- `sections.summary`,
- `sections.experience`,
- `sections.education`,
- `sections.skills`,
- `sections.languages`,
- `assumptions`,
- `warnings`.

Saving manual edits must keep the same object shape. Section editing may change field values inside the draft, but it must not replace the draft with markdown, arbitrary HTML, a PDF document, or a normalized section format.

The saved row's top-level `language` metadata must match `draft.language`. This lets S-06 list saved CVs without reading the JSON payload and lets S-08 preserve output language through generation, editing, saving, and export.

## Minimal Source Snapshot

The `source_snapshot` payload should preserve only the minimum provenance needed to understand what generated the saved draft.

Minimum source snapshot fields:

- `questionnaireVersion` - the questionnaire version used for generation.
- `answers` - the submitted questionnaire answers used for the current generated draft.
- `capturedAt` - ISO timestamp for when the source snapshot was captured.

The source snapshot exists to support future regeneration, debugging, and user trust. It is not a general event log, analytics payload, prompt log, model-response archive, or autosave history.

If a later slice changes generation input shape, it should version `source_snapshot` intentionally rather than silently widening the payload.

## Listing Metadata

The saved CV library should be able to render a minimal list without inspecting the full draft JSON.

S-06 should list saved CVs using:

- `title`,
- `language`,
- `created_at`,
- `updated_at`.

If a user has not named the CV, S-06 should provide a simple default title. The contract does not require target role, completion status, warning counts, export state, thumbnail previews, tags, or search metadata.

## Explicit Save Semantics

The MVP save behavior is explicit save with overwrite.

Required behavior:

- A new generated CV may be saved as a new row owned by the authenticated user.
- Editing an existing saved CV and saving again updates the same row's `draft`, `source_snapshot` when relevant, `title`, `language`, and `updated_at`.
- The latest explicit save is the canonical version.
- Save feedback should be clear in S-06, but this contract does not choose the final UI copy or component.

Out of scope:

- Autosave.
- Per-keystroke persistence.
- Revision history.
- Merge conflict resolution.
- Concurrent collaborative editing.
- Undo after save beyond what S-05 keeps in local UI state.

## Hard Delete Semantics

Saved CV deletion is a hard delete for the MVP.

Required behavior:

- Deleting a saved CV removes the row.
- Deleting a row also removes the draft JSON and source snapshot stored in that row.
- Deleted CVs should no longer appear in the saved CV library or be reopenable.

Out of scope:

- Soft delete.
- Trash or restore UI.
- Retention windows.
- Exported PDF file cleanup, because exported PDFs are not persisted by this contract.

## Privacy And RLS Boundary

CV data and questionnaire answers are private to the authenticated owner.

The database privacy boundary must be:

- every saved CV row has a non-null `user_id`,
- `user_id` references `auth.users.id`,
- row level security is enabled on `public.cvs`,
- select, insert, update, and delete policies require the authenticated user to own the row.

Future S-06 API routes should still verify the authenticated user through the existing per-request Supabase SSR pattern, but route-level checks are not enough by themselves. RLS is the load-bearing guard against accidental cross-user access.

There is no MVP sharing, workspace ownership, team account model, public CV link, admin role, or collaborator role.

## Representative SQL Sketch

The future S-06 migration should convert this sketch into production SQL. This sketch is intentionally representative: it fixes the contract shape and privacy policy, but it is not a migration file and has not been applied to any Supabase project.

```sql
create table public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  language text not null check (language in ('en', 'pl', 'ru')),
  draft jsonb not null,
  source_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cvs enable row level security;

create policy "Users can view their own CVs"
  on public.cvs
  for select
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can create their own CVs"
  on public.cvs
  for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update their own CVs"
  on public.cvs
  for update
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete their own CVs"
  on public.cvs
  for delete
  using (auth.uid() is not null and auth.uid() = user_id);
```

Production migration notes for S-06:

- Keep `user_id` non-null and owner-controlled; never accept a client-provided owner that differs from the authenticated user.
- Keep `draft` and `source_snapshot` as `jsonb` for the MVP, with runtime validation in the application layer when S-06 writes rows.
- Keep listable fields outside JSON so the library query can select `id`, `title`, `language`, `created_at`, and `updated_at` without loading CV content.
- Consider an `updated_at` trigger in the production migration if S-06 does not set it explicitly on every save.
- Do not add soft-delete columns unless the retention decision changes.

## Logging And Diagnostics Rules

CV content and questionnaire answers are sensitive user data. They must not be logged as raw payloads.

Allowed diagnostics:

- saved CV id,
- authenticated user id only when needed for server-side diagnostics,
- schema version,
- questionnaire version,
- language,
- section counts,
- warning codes,
- stable error buckets,
- timestamps.

Forbidden diagnostics:

- raw `draft` JSON,
- raw `source_snapshot.answers`,
- raw questionnaire answers,
- generated summary or experience text,
- prompt text,
- model response text,
- Supabase secret names or values,
- stack traces in user-facing messages.

Future implementation can add structured server logs, but they must preserve these boundaries.

## S-06 API Handoff Rules

Future S-06 API routes should use the existing Astro/Supabase conventions rather than introducing a separate data layer.

Required route behavior:

- Create a Supabase client per request through `createClient(context.request.headers, context.cookies)`.
- Treat a missing Supabase client as `service_unavailable` or an equivalent plain user-facing failure.
- Verify the authenticated user with `supabase.auth.getUser()` before authorization-sensitive saved-CV work.
- Use the verified `user.id` as the saved CV `user_id`; do not trust a submitted owner id.
- Let RLS remain enabled and active for all saved-CV reads and writes.
- Return only owner-visible rows for list and reopen behavior.
- Use explicit save semantics for creates and updates.
- Use hard delete for delete behavior.

User-facing failures must not expose raw CV payloads, raw questionnaire answers, provider internals, Supabase secret names, stack traces, or SQL details. If an implementation failure needs diagnostics, log only the safe diagnostic fields listed above.

## Out Of Scope

- Production Supabase migration.
- Generated database types.
- Save/reopen/list/delete API routes.
- Saved CV library UI.
- Autosave.
- Revision history.
- Soft delete.
- Sharing, workspaces, collaborators, public links, or admin roles.
- Persisted exported PDFs.
- Storage buckets.
- Background jobs, queues, durable task orchestration, analytics pipelines, or broad repository abstractions.

## Downstream Handoff Map

| Slice                    | Reuse these sections                                                                                                     | Planning note                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| S-04 generated CV draft  | `Minimal Source Snapshot`, `Logging And Diagnostics Rules`                                                               | Generation should provide versioned questionnaire data without logging raw private payloads.              |
| S-05 section editing     | `GeneratedCvDraft Payload Preservation`, `Explicit Save Semantics`                                                       | Editing should preserve the structured draft object and hand the latest edited snapshot to save behavior. |
| S-06 saved CV library    | `Saved CV Row Shape`, `Listing Metadata`, `Explicit Save Semantics`, `Hard Delete Semantics`, `Privacy And RLS Boundary` | Plan migrations, routes, dashboard list, reopen, save, and delete against this contract.                  |
| S-07 PDF export          | `GeneratedCvDraft Payload Preservation`, `Logging And Diagnostics Rules`                                                 | Export should consume the saved structured draft, not arbitrary HTML or a persisted PDF file.             |
| S-08 full saved PDF flow | `GeneratedCvDraft Payload Preservation`, `Listing Metadata`, `Privacy And RLS Boundary`                                  | Preserve selected output language through generation, editing, saving, reopen, and export.                |

### Files To Load First

Future agents planning S-06 or S-08 should read:

- `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`
- `context/changes/generation-export-decision-contract/decision-contract.md`
- `context/changes/generation-export-decision-contract/cv-contract.fixture.json`
- `context/changes/generation-export-decision-contract/pdf-runtime-spike.md`

## Non-Decisions

- Final migration filename.
- Final database type-generation command.
- Final API route paths.
- Final save-button UI copy.
- Whether S-06 exposes delete in the first saved-library UI or only prepares the route contract.
