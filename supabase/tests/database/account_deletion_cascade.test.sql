-- pgTAP: the erasure contract behind S-08 account deletion (FR-011 / "Right to erasure").
--
-- Why this test exists: the product deletes a user by deleting exactly one row —
-- `auth.users` — and trusts `on delete cascade` to take everything else with it
-- (src/lib/supabase-admin.ts). Nothing in the application layer re-checks that. A future
-- migration that adds a user-scoped table with `on delete set null`, `on delete restrict`,
-- or no cascade at all would silently orphan personal data of a "deleted" account, and
-- every unit test, E2E spec, and type check would stay green.
--
-- So the assertions come in two kinds:
--   1. the cascade actually removes the four known tables' rows (behavioral proof), and
--   2. an inventory of every `public` foreign key pointing at `auth.users` (structural
--      proof) — a NEW table lands here as a failure, forcing a deliberate decision rather
--      than a silent gap.
--
-- Run: `npm run db:start` then `npm run test:db`. Not in CI — `.github/workflows/ci.yml`
-- has no Postgres, exactly like the Playwright suite.
--
-- The whole test runs inside a transaction that is rolled back, so the throwaway user and
-- its rows never persist in the local database.

begin;

-- pgTAP is available in the Supabase Postgres image but not installed by default. Creating
-- it here (rather than in a migration) keeps a test-only extension out of the production
-- schema; the rollback below drops it again on a database that did not already have it.
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(10);

-- A fixed id keeps the assertions readable; the rollback makes collisions impossible.
-- `email` is set because auth.users carries a partial unique index on it.
insert into auth.users (id, email)
values ('a0000000-0000-4000-8000-000000000508', 's08-cascade@example.test');

insert into public.cvs (user_id, title, language, draft, source_snapshot)
values ('a0000000-0000-4000-8000-000000000508', 'S-08 cascade fixture', 'en', '{}'::jsonb, '{}'::jsonb);

insert into public.subscriptions (user_id, status, current_period_end)
values ('a0000000-0000-4000-8000-000000000508', 'active', now() + interval '30 days');

insert into public.feedback (user_id, generation_event_id, helpful)
values ('a0000000-0000-4000-8000-000000000508', 'b0000000-0000-4000-8000-000000000508', true);

insert into public.generation_usage (user_id)
values ('a0000000-0000-4000-8000-000000000508');

-- Prove the fixture landed. Without this, the post-delete "zero rows" assertions would pass
-- just as happily against a seed that never inserted anything.
select is(
  (select count(*) from public.cvs where user_id = 'a0000000-0000-4000-8000-000000000508'),
  1::bigint,
  'fixture: the throwaway user owns one CV'
);
select is(
  (select count(*) from public.subscriptions where user_id = 'a0000000-0000-4000-8000-000000000508'),
  1::bigint,
  'fixture: the throwaway user owns one subscription row'
);
select is(
  (select count(*) from public.feedback where user_id = 'a0000000-0000-4000-8000-000000000508'),
  1::bigint,
  'fixture: the throwaway user owns one feedback row'
);
select is(
  (select count(*) from public.generation_usage where user_id = 'a0000000-0000-4000-8000-000000000508'),
  1::bigint,
  'fixture: the throwaway user owns one generation-ledger row'
);

-- The point of no return, and the only statement the application actually issues.
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000508';

select is(
  (select count(*) from public.cvs where user_id = 'a0000000-0000-4000-8000-000000000508'),
  0::bigint,
  'deleting auth.users removes the user''s CVs and their questionnaire snapshots'
);
select is(
  (select count(*) from public.subscriptions where user_id = 'a0000000-0000-4000-8000-000000000508'),
  0::bigint,
  'deleting auth.users removes the user''s subscription row'
);
select is(
  (select count(*) from public.feedback where user_id = 'a0000000-0000-4000-8000-000000000508'),
  0::bigint,
  'deleting auth.users removes the user''s feedback'
);
select is(
  (select count(*) from public.generation_usage where user_id = 'a0000000-0000-4000-8000-000000000508'),
  0::bigint,
  'deleting auth.users removes the user''s generation-ledger rows'
);

-- Structural inventory. `confdeltype` is the ON DELETE action: 'c' = cascade, 'a' = no
-- action, 'r' = restrict, 'n' = set null, 'd' = set default. Anything but 'c' on a table
-- keyed by user leaves personal data behind after the account row is gone.
select is(
  (
    select count(*)
    from pg_constraint fk
    join pg_class child on child.oid = fk.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = fk.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    where fk.contype = 'f'
      and child_ns.nspname = 'public'
      and parent_ns.nspname = 'auth'
      and parent.relname = 'users'
      and fk.confdeltype <> 'c'
  ),
  0::bigint,
  'every public foreign key into auth.users deletes on cascade'
);

-- Deliberately brittle: a new user-scoped table must update this number, which is the
-- moment someone has to think about whether erasure still holds for it.
select is(
  (
    select count(*)
    from pg_constraint fk
    join pg_class child on child.oid = fk.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = fk.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    where fk.contype = 'f'
      and child_ns.nspname = 'public'
      and parent_ns.nspname = 'auth'
      and parent.relname = 'users'
  ),
  4::bigint,
  'exactly four public tables reference auth.users (cvs, subscriptions, feedback, generation_usage)'
);

select * from finish();

rollback;
