# Entitlement Contract and Store (F-01) — Plan Brief

> Full plan: `context/changes/entitlement-contract-and-store/plan.md`

## What & Why

Add an additive subscription store and a single server-authoritative entitlement
resolver that answers "is this user Advanced right now?" — the one source of truth the
whole commercial loop reads. This is roadmap slice F-01, the foundation the tier gate
(S-01) and checkout (S-02) both depend on; deciding the entitlement shape here prevents
S-01 and S-02 from drifting into incompatible reads/writes.

## Starting Point

The app persists everything in a single `public.cvs` table with owner-only RLS and a
reusable `set_updated_at` trigger; types are generated into `src/db/database.types.ts`;
services in `src/lib/services/` take `(supabase, userId)` and throw on DB error. There
is **no subscription/entitlement table and no service-role client** anywhere yet.

## Desired End State

A `public.subscriptions` table (one row per subscriber: `status` +
`current_period_end`) that users can read but not write, and a `resolveEntitlement`
function returning `{ tier, isAdvanced, activeUntil }` — computing "active right now"
against the database clock and defaulting to Basic when no row exists. A privileged
`upsertEntitlement` helper exists for seeding/tests and for S-02 to reuse.

## Key Decisions Made

| Decision                  | Choice                                                        | Why (1 sentence)                                                                 | Source   |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------- |
| Record shape              | `status` + `current_period_end` (unique `user_id`)           | Smallest shape that encodes "Advanced until end of paid period" and maps to S-02 | Plan     |
| Resolver return           | Rich DTO `{ tier, isAdvanced, activeUntil }`                  | One call serves both the server gate and the UI badge S-01 will need             | Plan     |
| No-row behavior           | Absence ⇒ Basic; rows exist only for subscribers             | Additive & cheap — free majority needs zero writes, no backfill                  | Plan     |
| Write access (RLS)        | Users read own row only; **no** user write policy            | FR-003 unbypassable — a self-writable entitlement is not a gate                  | Plan     |
| Time source               | Compare against `now()` in a Postgres `get_entitlement()` fn | One authoritative clock, no Worker/DB skew, can't be bypassed client-side        | Plan     |
| Surface                   | Server resolver only — no HTTP endpoint                      | Roadmap = storage + read contract; S-01 adds an endpoint if a client needs it    | Plan     |
| Seeding / write path      | SQL seed snippet + a `upsertEntitlement` repo helper         | Gives S-01 a real seeded row and S-02 a shared, tested write contract            | Plan     |

## Scope

**In scope:** `subscriptions` migration (table + read-only RLS + `get_entitlement()`
function); regenerated types; `EntitlementStatus` DTO; `resolveEntitlement` resolver;
privileged `upsertEntitlement` helper; hermetic resolver tests + documented seed and
integration checks.

**Out of scope:** payment provider / checkout / webhooks (S-02); tier enforcement in
generation and any UI (S-01); an HTTP entitlement endpoint; a productionized
service-role client; user backfill; multiple tiers or billing history.

## Architecture / Approach

Bottom-up: schema is the contract everyone reads, so it lands first; then the resolver +
DTO; then tests and the seed contract. The resolver delegates the time comparison to
Postgres (`now()`) via a `security invoker` SQL function scoped to `auth.uid()`, so there
is exactly one clock and the read respects RLS. "Active right now" = `current_period_end
> now()`, which makes a canceled-but-not-yet-elapsed subscription still Advanced — the
cancellation rule, encoded in data with no extra flag.

## Phases at a Glance

| Phase                       | What it delivers                                              | Key risk                                                      |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 1. Schema & migration       | `subscriptions` table, read-only RLS, `get_entitlement()`    | Getting RLS write-denial right (must diverge from `cvs`)     |
| 2. Resolver service & types | `EntitlementStatus` DTO, `resolveEntitlement`, write helper  | Correct no-row default and snake→camel mapping               |
| 3. Tests & seed contract    | Hermetic resolver tests + seed/integration-check docs        | Pinning oracle to PRD rules, not the implementation          |

**Prerequisites:** local Supabase (`npm run db:start` / `db:reset`); no other slice
needed — F-01 has no prerequisites.
**Estimated effort:** ~1 focused session across 3 small phases.

## Open Risks & Assumptions

- The hermetic tests stub `rpc`, so the real `now()` boundary and RLS write-denial are
  proven by **ad-hoc** integration checks against the local DB, not CI — acceptable per
  the project's two-layer test strategy, but it means those guarantees aren't gated on
  every commit.
- `upsertEntitlement` requires a privileged (service-role) client that doesn't exist
  yet; this slice keeps it client-agnostic and unwired — S-02 productionizes it.
- Assumes one subscription row per user is sufficient (no billing history) — true for
  the single-tier Wave 1 scope.

## Success Criteria (Summary)

- A seeded future-dated subscription makes `resolveEntitlement` return Advanced; no row
  (or a past-dated row) returns Basic.
- An authenticated user cannot write their own entitlement row (RLS denies it).
- `public.cvs` and existing saved CVs are completely unchanged (additive only).
