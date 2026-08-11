-- Migration: create public.subscriptions (entitlement store)
--
-- Implements the F-01 entitlement contract & store
-- (context/changes/entitlement-contract-and-store/plan.md). One row per subscriber:
-- `status` + `current_period_end` express the entitlement. "Advanced right now" is
-- defined purely by `current_period_end > now()`, so a canceled-but-not-yet-elapsed
-- subscription is still Advanced — the cancellation rule encoded in data, no extra flag.
--
-- Additive only: does NOT touch public.cvs or the GeneratedCvDraft shape (FR-012).
-- Absence of a row means Basic — free users need no row, existing accounts need no backfill.
--
-- Security (FR-003, unbypassable): RLS grants an authenticated user SELECT on their OWN
-- row only and NO insert/update/delete. With RLS enabled and no write policy, Postgres
-- denies all writes for the authenticated role by default, so a user cannot self-grant
-- Advanced. All writes go through a privileged (service-role) client that bypasses RLS
-- (S-02's webhook later; seed/tests now). This deliberately diverges from public.cvs,
-- which lets users write their own rows.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null check (status in ('active', 'canceled', 'expired')),
  current_period_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at honest without relying on the application layer to set it.
-- Reuses the public.set_updated_at() function defined in the cvs migration.
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at ();

-- DB clock is the only clock: "active right now" is computed in Postgres via now(),
-- scoped to the current user via auth.uid(). security invoker so RLS still applies.
-- Returns zero rows when the user has no subscription (resolver maps that to Basic).
create function public.get_entitlement ()
returns table (is_advanced boolean, current_period_end timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (s.current_period_end > now()) as is_advanced,
    s.current_period_end
  from public.subscriptions s
  where s.user_id = auth.uid()
  limit 1;
$$;

-- Row-level security: read-own-only. No write policy — user writes are denied by default.
alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions
  for select
  to authenticated
  using (auth.uid() is not null and auth.uid() = user_id);
