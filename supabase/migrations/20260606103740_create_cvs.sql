-- Migration: create public.cvs (first migration in the repo)
--
-- Implements the F-02 persistence/privacy contract
-- (context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md).
-- One row per saved CV: JSONB `draft` (GeneratedCvDraft) + JSONB `source_snapshot`
-- (questionnaire answers + version). Listable fields (title, language, timestamps)
-- live outside JSON so the library query never loads CV content.
--
-- Security: row-level security enabled with owner-only policies on every operation.
-- `user_id` is non-null and owner-controlled; never accept a client-provided owner.

create table public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  language text not null check (language in ('en', 'pl', 'ru')),
  draft jsonb not null,
  source_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Library listing query orders by most-recently-updated, scoped to the owner.
create index cvs_user_id_updated_at_idx on public.cvs (user_id, updated_at desc);

-- Keep updated_at honest without relying on the application layer to set it.
create function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cvs_set_updated_at
before update on public.cvs
for each row
execute function public.set_updated_at ();

-- Row-level security: owner-only access on every operation.
alter table public.cvs enable row level security;

create policy "Users can view their own CVs"
  on public.cvs
  for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can create their own CVs"
  on public.cvs
  for insert
  to authenticated
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can update their own CVs"
  on public.cvs
  for update
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users can delete their own CVs"
  on public.cvs
  for delete
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);
