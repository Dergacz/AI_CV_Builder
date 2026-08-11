-- Migration: create public.generation_usage (S-06 daily-generation-limit)
--
-- Append-only ledger: one row per SUCCESSFUL CV generation. Stores no content —
-- only who generated and when — so it adds no privacy surface beyond the identity
-- already implied by public.cvs. Backs the two FR-012 limits:
--   * per-user:     100 generations per UTC day (the backstop)
--   * product-wide: 500 generations per rolling hour (the cross-account cost vector)
--
-- Additive only: does NOT touch public.cvs, public.feedback, or public.subscriptions.
-- The PRD (prd-v3.md:318) forbids building this on the dormant billing scaffolding,
-- so the limit gets its own store rather than becoming an entitlement tier.
--
-- Security: RLS is enabled with NO POLICIES AT ALL — deliberately tighter than
-- public.subscriptions, which grants select-own. The app never reads or writes this
-- table directly; every access goes through the two security-definer functions below.
-- With RLS on and no policy present, Postgres denies the authenticated role every
-- operation by default.
--
-- Erasure (S-08): `on delete cascade` from auth.users drops a user's ledger rows with
-- their account, so account deletion needs no extra work for this table.

create table public.generation_usage (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No updated_at / no trigger: the table is append-only and rows are never modified.

-- Per-user daily count.
create index generation_usage_user_id_created_at_idx
  on public.generation_usage (user_id, created_at desc);

-- Product-wide rolling-hour count.
create index generation_usage_created_at_idx
  on public.generation_usage (created_at desc);

alter table public.generation_usage enable row level security;

-- The start of the current UTC day, written explicitly: date_trunc('day', now()) on a
-- timestamptz resolves against the session TimeZone setting, which is not something a
-- quota boundary should depend on. Both quota functions must agree on the boundary, so
-- it lives in exactly one place. Not granted to any client role — it is called only
-- from inside the definer functions below, which run as the owner.
create function public.generation_usage_day_start ()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
$$;

-- Verdict function: 'ok' | 'user_daily' | 'global_hourly'.
--
-- security definer because the product-wide count must see rows across ALL users, which
-- RLS would otherwise hide — and this app has no service-role client to bypass it with.
-- The function returns a verdict string and never rows, so no cross-user data escapes.
-- The per-user check runs first so a user at their own cap is told so, rather than being
-- shown an unrelated product-wide outage message.
create function public.check_generation_quota (p_daily_limit int, p_hourly_ceiling int)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_user_count   int;
  v_global_count int;
begin
  -- Defensive: the API route guards auth before calling. If this ever fires, the route's
  -- fail-open catch turns it into "allow", which is the correct posture for a counter fault.
  if v_user_id is null then
    raise exception 'check_generation_quota requires an authenticated caller';
  end if;

  select count(*) into v_user_count
  from public.generation_usage
  where user_id = v_user_id
    and created_at >= public.generation_usage_day_start();

  if v_user_count >= p_daily_limit then
    return 'user_daily';
  end if;

  select count(*) into v_global_count
  from public.generation_usage
  where created_at >= now() - interval '1 hour';

  if v_global_count >= p_hourly_ceiling then
    return 'global_hourly';
  end if;

  return 'ok';
end;
$$;

-- Write side: record one successful generation, but ONLY while the caller is still under
-- their own daily cap. That condition is load-bearing in two ways:
--
--   1. This function has to be execute-grantable to `authenticated` (the app has no
--      privileged client), so any signed-in user can call it directly over PostgREST.
--      Unbounded, one attacker could cheaply insert enough rows to trip the GLOBAL hourly
--      ceiling and deny generation to everyone — the abuse guard would itself become a DoS
--      vector. Capping each account at p_daily_limit/day means reaching the global ceiling
--      genuinely requires many accounts, which is exactly the vector it exists to catch.
--
--   2. It makes the ledger self-bounding under concurrency. Several requests may clear the
--      pre-flight check together, but the overflow inserts are refused here, so the stored
--      count can never exceed the cap.
--
-- Returns whether a row was written. Callers treat `false` as informational: the draft is
-- already built by the time this runs and is returned either way.
create function public.record_generation (p_daily_limit int)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user_id  uuid := auth.uid();
  v_inserted int;
begin
  if v_user_id is null then
    raise exception 'record_generation requires an authenticated caller';
  end if;

  insert into public.generation_usage (user_id)
  select v_user_id
  where (
    select count(*)
    from public.generation_usage
    where user_id = v_user_id
      and created_at >= public.generation_usage_day_start()
  ) < p_daily_limit;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

-- security definer functions are executable by PUBLIC by default; revoke that and grant
-- narrowly so only signed-in callers can reach them. The day-start helper stays ungranted.
revoke all on function public.generation_usage_day_start () from public;
revoke all on function public.check_generation_quota (int, int) from public;
revoke all on function public.record_generation (int) from public;

grant execute on function public.check_generation_quota (int, int) to authenticated;
grant execute on function public.record_generation (int) to authenticated;
