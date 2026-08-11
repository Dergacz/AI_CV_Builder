-- Migration: create public.feedback (S-05 post-generation-feedback)
--
-- Persists one feedback row per (user, generation event). Keyed by a
-- content-free `generation_event_id` UUID — never by cv_id — to satisfy the
-- F-01 privacy contract (no CV/draft content linked from feedback).
--
-- Security: row-level security enabled with owner-only policies on every
-- operation. `user_id` is non-null and always set by the server; the unique
-- constraint on (user_id, generation_event_id) enforces one row per verdict
-- so re-submission is an upsert, not a duplicate.

create table public.feedback (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users (id) on delete cascade,
  generation_event_id  uuid        not null,
  helpful              boolean     not null,
  comment              text        check (comment is null or char_length(comment) <= 1000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, generation_event_id)
);

-- Keep updated_at honest without relying on the application layer.
-- Reuses public.set_updated_at() defined in the cvs migration.
create trigger feedback_set_updated_at
before update on public.feedback
for each row
execute function public.set_updated_at ();

-- Row-level security: owner-only access on every operation.
alter table public.feedback enable row level security;

create policy "Users can view their own feedback"
  on public.feedback
  for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can insert their own feedback"
  on public.feedback
  for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update their own feedback"
  on public.feedback
  for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);
