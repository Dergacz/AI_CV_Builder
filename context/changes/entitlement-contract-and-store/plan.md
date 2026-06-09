# Entitlement Contract and Store (F-01) Implementation Plan

## Overview

Add an **additive, owner-read-only subscription store** plus **one server-authoritative
entitlement resolver** that answers a single question — "is this user Advanced right
now?" — using the database clock as the source of truth. This is the foundation slice
of the commercial loop: S-01 reads the resolver to choose the generation tier, and S-02
writes entitlement rows on verified payment. No checkout, no payment-provider
integration, and no UI live here — storage + read contract only.

The defining constraint is **FR-003 (unbypassable)**: the entitlement gate must be
server-authoritative and a user must not be able to grant themselves Advanced. This
forces a deliberate divergence from the existing `public.cvs` RLS pattern (where users
freely write their own rows): on `subscriptions`, users may **read** their own row but
**cannot write** it. Writes occur only through an elevated/service-role path (S-02's
webhook later; seed/tests now).

## Current State Analysis

- **Persistence:** a single `public.cvs` table with owner-only RLS
  (`supabase/migrations/20260606103740_create_cvs.sql`). There is **no
  subscription/entitlement table** — this slice creates the first one.
- **Migration conventions (established):** files named `YYYYMMDDHHmmss_*.sql`;
  `id uuid primary key default gen_random_uuid()`;
  `user_id uuid not null references auth.users (id) on delete cascade`;
  `created_at`/`updated_at timestamptz not null default now()`; a reusable
  `public.set_updated_at()` trigger function already exists, with a per-table
  `{table}_set_updated_at` BEFORE UPDATE trigger.
- **RLS conventions (established):** RLS enabled per table; four separate policies
  (select/insert/update/delete), all `to authenticated`, expression
  `auth.uid() is not null and auth.uid() = user_id`. **This slice intentionally does
  NOT replicate the insert/update/delete policies** (see Critical Implementation
  Details).
- **Types:** generated into `src/db/database.types.ts` via `npm run db:types`
  (`supabase gen types typescript --local`). Code references rows as
  `Database["public"]["Tables"]["<table>"]["Row" | "Insert" | "Update"]`.
- **Service layer:** thin functions in `src/lib/services/` taking
  `(supabase: TypedSupabaseClient, userId: string, …)`, throwing on DB error, returning
  camelCase DTOs mapped from snake_case rows (`cv-repository.ts`). Shared DTOs live in
  `src/types.ts`.
- **Auth:** `src/middleware.ts` resolves the user via `supabase.auth.getUser()` and
  attaches `context.locals.user` (`User | null`, typed in `src/env.d.ts`). Routes
  always re-verify `getUser()` after creating a client and pass the verified `user.id`
  to services; client-supplied owner is never trusted.
- **Testing:** Vitest, `npm test` (`vitest run`), tests live as `src/**/*.test.ts` and
  are hermetic/pure (no DB-integration harness exists today). Local DB lifecycle:
  `npm run db:start`, `npm run db:reset`. No `supabase/seed.sql` exists.
- **No service-role client exists** anywhere in `src/` — introducing privileged writes
  is net-new and is deliberately kept out of any user-facing route in this slice.

## Desired End State

After this plan:

- A `public.subscriptions` table exists, additive (no change to `public.cvs` or the
  `GeneratedCvDraft` shape), storing one row per subscriber with `status` +
  `current_period_end`.
- RLS lets an authenticated user **read only their own** subscription row and **denies
  all user writes** — verified by an integration check that a self-insert/self-update
  as the row owner fails.
- A single resolver `resolveEntitlement(supabase, userId)` returns
  `{ tier, isAdvanced, activeUntil }`, computing "active right now" against the DB clock
  via a `get_entitlement()` SQL function, and returns Basic when the user has no row.
- A `upsertEntitlement(privilegedClient, …)` helper exists for seeding/tests and for
  S-02 to reuse — never wired to a user-facing route here.
- `src/db/database.types.ts` is regenerated and includes the new table.

### Key Discoveries:

- Reusable trigger `public.set_updated_at()` already exists
  (`supabase/migrations/20260606103740_create_cvs.sql:27-40`) — the new table attaches a
  trigger to it, no new function needed.
- The `cvs` RLS expression `auth.uid() is not null and auth.uid() = user_id`
  (`…create_cvs.sql:44-68`) is the read-policy template; the **write** policies are
  deliberately omitted here.
- Resolver service signature `(supabase: TypedSupabaseClient, userId: string)` and the
  snake→camel DTO mapping pattern come from `src/lib/services/cv-repository.ts:46-91`.
- Type regeneration is `npm run db:types` (package.json); type access pattern is
  `Database["public"]["Tables"]["subscriptions"]["Row"]`.

## What We're NOT Doing

- **No payment-provider integration, no checkout, no webhooks** — that is S-02.
- **No tier enforcement in the generation path and no UI** (badge / upgrade prompt) —
  that is S-01.
- **No HTTP API endpoint** — the resolver is a server-side function only; no
  `GET /api/entitlement`. S-01 adds an endpoint if a client island needs the tier.
- **No service-role client factory wired into routes** — the write helper is
  client-agnostic and privileged; productionizing the elevated client is S-02's job.
- **No backfill of existing users** — absence of a row means Basic; existing accounts
  need no migration of data.
- **No multiple tiers, plans, or billing history** — single row per user, one paid
  tier; `status` + `current_period_end` only.

## Implementation Approach

Build bottom-up: schema first (the contract everything reads), then the resolver and
its DTO, then tests and the seed contract. The resolver delegates the time comparison to
Postgres (`now()`), so there is exactly one clock and the gate cannot be skewed or
bypassed client-side. "Active right now" is defined purely by `current_period_end >
now()` — a canceled subscription whose period has not yet ended is still Advanced, which
directly encodes the cancellation rule ("Advanced persists until end of paid period")
without a separate flag.

## Critical Implementation Details

- **Unbypassable RLS (security-critical, FR-003).** Unlike `public.cvs`, the
  `subscriptions` table must grant authenticated users **SELECT on their own row only**
  and **no INSERT/UPDATE/DELETE**. With RLS enabled and no write policy, Postgres denies
  all writes for the `authenticated` role by default — so a user cannot self-grant
  Advanced. All writes go through a privileged (service-role) client that bypasses RLS.
  Do **not** copy the `cvs` insert/update/delete policies onto this table.
- **DB clock is the only clock.** "Active right now" is computed in Postgres via a
  `get_entitlement()` SQL function using `now()`, not in the Worker. PostgREST filters
  take literal values, so a TS-side `new Date()` comparison would introduce a second
  clock — avoid it. The resolver calls `supabase.rpc('get_entitlement')`; the function
  runs `security invoker` so RLS still applies and it scopes to `auth.uid()`.
- **One row per user.** A `unique (user_id)` constraint makes the row upsertable by
  `user_id` and keeps the resolver a single-row read. Absence of a row ⇒ Basic.
- **The write helper is privileged, not user-facing.** `upsertEntitlement` must run with
  a client that bypasses RLS (service-role) or via raw SQL in tests. It is intentionally
  not imported by any route in this slice; wiring it to a real caller is S-02.

## Phase 1: Schema & Migration

### Overview

Create the additive `subscriptions` table with owner-read-only RLS and a DB-clock
entitlement function, then regenerate the typed schema.

### Changes Required:

#### 1. Subscriptions migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_subscriptions.sql` (new)

**Intent**: Create the entitlement store additively, attach the existing
`set_updated_at` trigger, enable RLS with read-own-only (no write policies), and define
the DB-clock resolver function. Encodes the cancellation rule purely via
`current_period_end`.

**Contract**:
- Table `public.subscriptions`:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null unique references auth.users (id) on delete cascade`
  - `status text not null check (status in ('active', 'canceled', 'expired'))`
  - `current_period_end timestamptz not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Trigger: `subscriptions_set_updated_at` BEFORE UPDATE FOR EACH ROW EXECUTE
  `public.set_updated_at()` (reuse existing function).
- `alter table public.subscriptions enable row level security;`
- **Exactly one** policy for the `authenticated` role:
  `create policy "Users can view their own subscription" on public.subscriptions for
  select to authenticated using (auth.uid() is not null and auth.uid() = user_id);`
  No insert/update/delete policies — writes are denied to users by default.
- `get_entitlement()` SQL function — `security invoker`, `language sql`, `stable`,
  returns the active flag and period end for the current user using the DB clock:

```sql
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
```

(Returns zero rows when the user has no subscription — the resolver maps that to Basic.)

#### 2. Regenerate database types

**File**: `src/db/database.types.ts` (regenerated)

**Intent**: Make the new table and RPC available to TypeScript.

**Contract**: Run `npm run db:types` against the local DB after the migration applies;
the generated `Database["public"]["Tables"]["subscriptions"]` and the
`get_entitlement` function type must appear. Do not hand-edit the file.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly on reset: `npm run db:reset`
- Types regenerate without error and include `subscriptions`: `npm run db:types`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- `public.cvs` is unchanged after the migration (no altered columns, no data loss).
- As an authenticated user, selecting another user's subscription row returns nothing
  (RLS read scoping holds).
- As an authenticated user, an INSERT/UPDATE on `subscriptions` for one's own
  `user_id` is **denied** by RLS.
- `select * from public.get_entitlement()` returns no rows for a user with no
  subscription, and `is_advanced = true` for a seeded row with a future
  `current_period_end`.

**Implementation Note**: After automated verification passes, pause for manual
confirmation (RLS write-denial and the `now()` boundary are the load-bearing checks)
before proceeding to Phase 2.

---

## Phase 2: Resolver Service & Types

### Overview

Expose the entitlement contract to server-side callers: a DTO, the read resolver
(defaulting to Basic), and a privileged write helper for seeding and S-02.

### Changes Required:

#### 1. Entitlement DTO

**File**: `src/types.ts`

**Intent**: Add the shared entitlement contract returned by the resolver and consumed by
S-01 (gate + UI badge).

**Contract**: Add a `GenerationTier = "basic" | "advanced"` type and an
`EntitlementStatus` interface: `{ tier: GenerationTier; isAdvanced: boolean; activeUntil:
string | null }`. `activeUntil` is the ISO `current_period_end` when Advanced, else
`null`. Follow the existing camelCase DTO style.

#### 2. Entitlement resolver service

**File**: `src/lib/services/entitlements.ts` (new)

**Intent**: The single server-authoritative read — "is this user Advanced right now?" —
backed by the DB-clock function, defaulting to Basic when no row exists.

**Contract**:
- `resolveEntitlement(supabase: TypedSupabaseClient, userId: string): Promise<EntitlementStatus>`
  — calls `supabase.rpc("get_entitlement")`; throws on DB error (per service
  convention). Maps zero rows ⇒ `{ tier: "basic", isAdvanced: false, activeUntil: null }`.
  Maps a row to `{ tier: is_advanced ? "advanced" : "basic", isAdvanced, activeUntil:
  is_advanced ? current_period_end : null }`. The `userId` parameter keeps the signature
  consistent and is used for assertion/logging; authority for the read is `auth.uid()`
  inside the function.
- `TypedSupabaseClient = SupabaseClient<Database>` (mirror `cv-repository.ts`).

#### 3. Privileged upsert helper

**File**: `src/lib/services/entitlements.ts`

**Intent**: One tested write path for seeding/tests now and S-02's webhook later — never
called from a user-facing route in this slice.

**Contract**:
`upsertEntitlement(client: TypedSupabaseClient, userId: string, input: { status:
"active" | "canceled" | "expired"; currentPeriodEnd: string }): Promise<void>` — upserts
on `user_id` (`onConflict: "user_id"`); throws on error. Document that `client` must be
privileged (service-role / RLS-bypassing); the function does not create that client.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`
- Existing tests still pass: `npm test`

#### Manual Verification:

- `resolveEntitlement` returns Basic for a user with no row and Advanced for a seeded
  future-dated row (exercised via the Phase 3 tests / a scratch call).

**Implementation Note**: After automated verification passes, pause for manual
confirmation before proceeding to Phase 3.

---

## Phase 3: Tests & Seed Contract

### Overview

Lock the resolver's behavioral contract with hermetic tests, and document the seed path
plus the ad-hoc integration checks that real infra (not a stub) must prove.

### Changes Required:

#### 1. Resolver contract tests

**File**: `src/lib/services/entitlements.test.ts` (new)

**Intent**: Prove the resolver's mapping and default behavior — the regressions that
would silently mis-tier a user — using a hermetic stub of the Supabase `rpc` call (the
established test style; no DB harness exists).

**Contract**: Cover, with the oracle drawn from the PRD/roadmap rules (not the
implementation): (a) no row ⇒ Basic / `isAdvanced: false` / `activeUntil: null`;
(b) row with future `current_period_end` and `is_advanced: true` ⇒ Advanced with
`activeUntil` set; (c) row with `is_advanced: false` (past period, e.g. expired or
canceled-and-elapsed) ⇒ Basic with `activeUntil: null`; (d) an `rpc` error propagates
as a throw. Use `it.each` for the tier-mapping cases rather than near-duplicate tests.

#### 2. Seed snippet & integration-check doc

**File**: `context/changes/entitlement-contract-and-store/plan.md` (this file) +
`context/foundation/test-plan.md` §6 cookbook

**Intent**: Give S-01 a ready seed row and record the integration assertions that the
hermetic tests deliberately cannot make (real `now()` boundary, RLS write-denial,
`unique(user_id)`).

**Contract**: Document a seed `insert into public.subscriptions (user_id, status,
current_period_end) values ('<auth-user-uuid>', 'active', now() + interval '30 days');`
run via the local DB, and list the ad-hoc integration checks (below in Testing Strategy)
as the manual gate. Append a one-line cookbook entry pointing future tier work at
`resolveEntitlement`.

### Success Criteria:

#### Automated Verification:

- New resolver tests pass: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- The documented seed snippet produces an Advanced result from
  `resolveEntitlement` / `get_entitlement()` against the local DB.
- The integration checks in Testing Strategy (RLS write-denial, `now()` boundary,
  unique-user constraint) pass against the local DB.

**Implementation Note**: After automated verification passes, pause for manual
confirmation of the integration checks.

---

## Testing Strategy

### Unit Tests (hermetic — stub the `rpc` client):

- Resolver default: no row ⇒ Basic.
- Resolver mapping (`it.each`): future-dated active/canceled ⇒ Advanced with
  `activeUntil`; past-dated/expired ⇒ Basic with `activeUntil: null`.
- Resolver error: an `rpc` error throws (callers handle it like other DB errors).

### Integration Tests (ad-hoc — real local DB; no permanent harness added here):

These prove what a stub would lie about and are run against `npm run db:reset` + a
seeded row:

- **RLS write-denial (security):** an authenticated user cannot INSERT or UPDATE their
  own `subscriptions` row (FR-003).
- **DB-clock boundary:** `current_period_end` one second in the future ⇒ Advanced; one
  second in the past ⇒ Basic — proving `now()` is the authority.
- **Single row per user:** a second insert for the same `user_id` violates
  `unique(user_id)`.

(The integration gate stays ad-hoc per the project's two-layer strategy; running local
Supabase is opt-in, not a per-commit CI gate.)

### Seed snippet (for S-01 / dev — privileged path):

User writes are denied by RLS, so seed via a privileged path. Two equivalent options:

- **SQL (manual, against the local DB).** `user_id` is a FK to `auth.users`, so the
  target user must exist first:

  ```sql
  insert into public.subscriptions (user_id, status, current_period_end)
  values ('<auth-user-uuid>', 'active', now() + interval '30 days');
  ```

- **Programmatic (`upsertEntitlement`).** Call with a service-role client:
  `upsertEntitlement(serviceRoleClient, userId, { status: "active", currentPeriodEnd:
  new Date(Date.now() + 30*864e5).toISOString() })`. This is the same write contract
  S-02's webhook will reuse.

A future-dated `current_period_end` makes `resolveEntitlement` return Advanced; a
past-dated one (or no row) returns Basic. (Note: `resolveEntitlement` reads via
`auth.uid()`, so a scratch service-role client without a user session always sees
Basic — verify the Advanced path through an authenticated session or the
`get_entitlement()` SQL check from Phase 1.)

> Cookbook (`test-plan.md §6`) deferred: no `context/foundation/test-plan.md` exists in
> the repo yet (it is owned by `/10x-test-plan`). When that file is created, add a
> one-line entry pointing future tier-gating work at `resolveEntitlement` as the single
> entitlement read.

### Manual Testing Steps:

1. `npm run db:reset` then `npm run db:types`; confirm `subscriptions` appears in the
   generated types and `public.cvs` is untouched.
2. Seed an active future-dated row for a test user; confirm `resolveEntitlement` returns
   `{ tier: "advanced", isAdvanced: true, activeUntil: <iso> }`.
3. Set `current_period_end` to the past; confirm the resolver returns Basic.
4. Attempt a self-INSERT/UPDATE as the row owner; confirm RLS denies it.

## Performance Considerations

Single-row indexed read (`unique(user_id)`) behind one `rpc` round trip per resolution;
negligible at the target scale (dozens to ~100 users, low QPS). The `now()` comparison
is evaluated in-DB with no added latency.

## Migration Notes

Purely additive: a new table, a new function, and a new trigger binding — no change to
`public.cvs`, the `GeneratedCvDraft` shape, or any existing row (FR-012). Rollback is
`drop function public.get_entitlement; drop table public.subscriptions;` with no data
backfill to reverse. No existing user needs a row created.

## References

- Roadmap slice F-01: `context/foundation/roadmap.md` (Foundations → F-01)
- PRD: `context/foundation/prd-v2.md` (FR-003 unbypassable, FR-012 additive; Access
  Control Changes → "New entitlement dimension")
- Pattern — table + RLS + trigger: `supabase/migrations/20260606103740_create_cvs.sql`
- Pattern — repository service + DTO mapping: `src/lib/services/cv-repository.ts:46-124`
- Pattern — typed client + auth: `src/lib/supabase.ts`, `src/middleware.ts`,
  `src/env.d.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.
> Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema & Migration

#### Automated

- [x] 1.1 Migration applies cleanly on reset: `npm run db:reset` — 82a6bbc
- [x] 1.2 Types regenerate and include `subscriptions`: `npm run db:types` — 82a6bbc
- [x] 1.3 Type checking passes: `npx astro check` — 82a6bbc
- [x] 1.4 Linting passes: `npm run lint` — 82a6bbc

#### Manual

- [x] 1.5 `public.cvs` unchanged (no altered columns, no data loss) — 82a6bbc
- [x] 1.6 Authenticated user cannot read another user's subscription row — 82a6bbc
- [x] 1.7 Authenticated user's self INSERT/UPDATE on `subscriptions` is denied by RLS — 82a6bbc
- [x] 1.8 `get_entitlement()` returns no rows for a user with no subscription, and
      `is_advanced = true` for a seeded future-dated row — 82a6bbc

### Phase 2: Resolver Service & Types

#### Automated

- [x] 2.1 Type checking passes: `npx astro check` — 67721cc
- [x] 2.2 Linting passes: `npm run lint` — 67721cc
- [x] 2.3 Existing tests still pass: `npm test` — 67721cc

#### Manual

- [x] 2.4 `resolveEntitlement` returns Basic for no row and Advanced for a seeded
      future-dated row — 5438a50

### Phase 3: Tests & Seed Contract

#### Automated

- [x] 3.1 New resolver tests pass: `npm test` — 5438a50
- [x] 3.2 Type checking passes: `npx astro check` — 5438a50
- [x] 3.3 Linting passes: `npm run lint` — 5438a50

#### Manual

- [x] 3.4 Documented seed snippet produces an Advanced result from the resolver — 5438a50
- [x] 3.5 Integration checks pass: RLS write-denial, `now()` boundary, unique-user
      constraint — 5438a50
