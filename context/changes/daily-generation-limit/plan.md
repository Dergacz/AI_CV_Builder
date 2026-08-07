# Daily Generation Limit + Aggregate Abuse Guard (S-06 / FR-012) Implementation Plan

## Overview

Enforce a **server-authoritative limit of 100 CV generations per user per UTC day** on `POST /api/cv/generate`, with a clear localized message when the wall is reached, plus a **coarse product-wide ceiling of 500 successful generations per rolling hour** that covers the cross-account cost vector FR-012 names. Both limits are backed by a new append-only `public.generation_usage` ledger and two `security definer` Postgres functions, so the gate cannot be skewed or bypassed from the user's device. This closes roadmap slice **S-06** / **FR-012** and answers PRD Open Question 5 (aggregate thresholds).

The load-bearing guardrail from the PRD is that this is **abuse protection, not a paywall** — it must never block a legitimate user under normal use. That single constraint drives most of the design decisions below (fail-open on counter error, no quota UI, successful-generations-only counting).

## Current State Analysis

- **Generation endpoint** `src/pages/api/cv/generate.ts:21` — the only protection today is a 40 KB `content-length` cap (`:30`). Order is: auth guard (`:22`) → size cap (`:30`) → JSON parse (`:36`) → zod `safeParse` (`:43`) → `OPENAI_API_KEY` presence (`:48`) → `generateCvDraft` (`:58`). There is **no per-user counter, no aggregate guard, and no Supabase client created in this route at all**.
- **Precedent for an unbypassable server gate** `supabase/migrations/20260609132956_create_subscriptions.sql` — RLS enabled with **no write policy** (Postgres denies authenticated writes by default), and a Postgres function as the authority so "the DB clock is the only clock". `resolveEntitlement()` (`src/lib/services/entitlements.ts:34`) is the service-layer shape: takes a typed client, calls `.rpc()`, throws on DB error, lets the caller map failures.
- **PRD hard constraint** (`context/foundation/prd-v3.md:318`): *"the previously-added, unused billing scaffolding stays untouched and inert; this release adds no billing behavior and does not build the daily limit on top of it."* → `public.subscriptions` and `entitlements.ts` must not be touched or extended. This needs its own store.
- **No service-role key exists** — `astro.config.mjs:19-30` declares no privileged Supabase credential. Any cross-user aggregate read must therefore be a `security definer` function; there is no RLS-bypassing client available to the app.
- **Error-surfacing seam is already generic**: the response carries a stable `error` bucket (`GenerationErrorBucket`, `src/lib/cv-draft-messages.ts:22`), and `QuestionnaireFlow.tsx:83-88` maps whatever bucket arrives through `getGenerationErrorMessages(locale)` with a safe fallback to `service_unavailable`. **Adding a bucket + its three locale strings is sufficient to make the wall message appear** — no client component changes are required.
- **Analytics props are allowlisted** — `src/lib/observability/scrub.ts:3` silently drops any key not in the 13-entry list. The event-name union is `ObservabilityEvent` (`src/lib/observability/index.ts:11`), which already carries a non-funnel event (`feedback_submitted`) as the S-05 precedent.
- **E2E constraint**: `e2e/post-generation-feedback.spec.ts:46` makes a **real, unmocked** call to `/api/cv/generate` (real OpenAI, 35 s timeout). Every other spec mocks the endpoint at the browser via `page.route('**/api/cv/generate', …)`, so the server never sees those requests. This rules out setting a global limit override on the shared dev server — it would break that spec.
- **UI error rendering** appends `copy.errorRetrySuffix` after the message (`QuestionnaireFlow.tsx:335`), which reads *" You can try again — your answers are kept."* — the new copy must compose sensibly with that suffix.

## Desired End State

A signed-in user who has already produced 100 successful CV generations today sees, on their next generate attempt, a clear localized message telling them the daily limit is reached and to try again tomorrow — rendered in the questionnaire's existing error panel, with their answers preserved. The refusal happens **before any OpenAI call**, so a blocked user costs nothing. Separately, if the product as a whole exceeds 500 successful generations in a rolling hour, generation is refused product-wide with the ordinary "temporarily unavailable" message until volume subsides. Both refusals emit a `generation_limit_reached` analytics event carrying only the limit kind and locale. If the counter itself is unreachable, generation proceeds normally and the failure is reported — availability wins over metering.

Verify by: setting the daily limit to a low value locally, generating past it, confirming a 429 with the localized wall message in all three locales; confirming `public.generation_usage` gained exactly one row per *successful* generation and none for failures; confirming a direct authenticated `insert` into `public.generation_usage` is denied by RLS; confirming the ordinary flow at 0 usage is byte-for-byte unchanged.

### Key Discoveries:

- The client requires **zero changes** — `QuestionnaireFlow.tsx:83` already localizes arbitrary buckets with a safe fallback. This is the single biggest scope reducer in the slice.
- The quota check must sit **before** the `OPENAI_API_KEY` presence check (`generate.ts:48`), not after. A quota refusal has nothing to do with provider configuration, and putting it first makes the E2E wall test work with no API key and no LLM spend.
- **`record_generation` must enforce the per-user cap itself, or the guard becomes a DoS vector.** The function has to be `execute`-grantable to `authenticated` (the app has no privileged client), which means any authenticated user can call it directly over PostgREST. Without a self-check, one attacker could cheaply insert 500 rows in an hour and trip the *global* ceiling, denying generation to everyone. Bounding the insert to the per-user daily cap caps each account's contribution at 100/day, so reaching the global ceiling genuinely requires many accounts — which is exactly the condition the guard is meant to catch.
- Because the write side is a conditional insert, the **ledger can never exceed the per-user cap** even under concurrency; the pre-flight check is only a spend-avoidance optimization, not the authority.
- `date_trunc('day', now())` on a `timestamptz` depends on the session `TimeZone` setting. The day boundary must be written explicitly as `date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'` so it is session-independent.
- Enabling RLS with **no policies at all** (tighter than `subscriptions`, which grants select-own) is correct here: the app never reads a user's usage rows, so the table should be reachable only through the two definer functions.

## What We're NOT Doing

- **No IP-based tracking or storage.** Storing `CF-Connecting-IP` would introduce personal data that cuts against the F-01 data-minimization posture and would require a Privacy Policy disclosure (S-09).
- **No new-account generation throttle.** Adding friction to brand-new accounts is the worst possible move during a release whose whole purpose is measuring new-user funnel conversion.
- **No quota display, no remaining-count endpoint, no approaching-the-limit warning.** Surfacing "12/100 used" makes a free product feel metered.
- **No signup throttle.** PRD Open Q5's second half ("any single-origin signup throttle") is explicitly deferred — this slice covers the generation ceiling only.
- **No use of `public.subscriptions` / `entitlements.ts`.** The billing scaffolding stays inert per PRD `:318`.
- **No infra-level (Cloudflare WAF / rate-limiting binding) rules.** The limit must be authoritative in application logic and testable in CI.
- **No admin surface** to view, reset, or exempt a user's quota.
- **No retention/pruning job** for `generation_usage`. Volume is bounded by the guard itself; see Migration Notes.
- **No reserve-then-confirm bookkeeping** to close the pre-flight race (see Critical Implementation Details).

## Implementation Approach

Build bottom-up in three phases: (1) stand up the ledger and the server-authoritative verdict, fully tested with no user-visible effect; (2) wire the verdict into the generation route, add the localized wall copy and the telemetry event; (3) prove the wall actually reaches the user in a browser.

The route becomes **check → generate → record**. The check runs after schema validation (so malformed requests cost no DB round-trip) but before the provider call (so a blocked user costs no spend). The record runs only after a successful generation, which is what makes "successful generations only" true.

## Critical Implementation Details

- **Fail-open is mandatory, in both directions.** If the quota check throws (DB down, timeout, no Supabase client), the route must **proceed with generation** and report the error — never refuse. Symmetrically, if `record_generation` throws after a *successful* generation, the route must still return the draft: bookkeeping failure must not destroy work the user already paid the wait for. Both are swallowed try/catch blocks with `reportError`, not bare `.catch()` that hides the signal.
- **Accepted race, stated deliberately.** Several concurrent requests can pass the pre-flight check against the same count and all proceed to generate. The ledger stays correct (the conditional insert refuses the overflow rows), so the over-grant is bounded by in-flight concurrency and self-corrects. Reserve-then-confirm was rejected: it adds compensating-delete bookkeeping on the critical path to protect against a leak far smaller than the one fail-open already accepts by design.
- **The wall copy must not embed the number.** Both limits are env-tunable; hardcoding "100" in three locales would silently lie the moment the env var changes. Copy stays generic ("today's limit", "try again tomorrow") and composes with the existing `errorRetrySuffix`.
- **Aggregate refusals are deliberately indistinguishable from an outage.** The global ceiling returns the existing `service_unavailable` bucket (503), not a new one — it is accurate for the affected user and does not confirm to an attacker that they found the global guard. Only the per-user wall gets the new `daily_limit_reached` bucket (429).

---

## Phase 1: Quota ledger + server-authoritative verdict

### Overview

Create the `generation_usage` ledger, the two Postgres functions that own the verdict and the write, and the typed service wrapper. Nothing is wired into any route yet — at the end of this phase the product behaves exactly as it does today.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_generation_usage.sql` (generate the prefix with `date -u +%Y%m%d%H%M%S`)

**Intent**: Create the append-only usage ledger plus the two functions that are the sole authority on quota. The ledger stores no content — only who generated and when — so it carries no privacy weight beyond the identity already implied by `public.cvs`.

**Contract**:

- Table `public.generation_usage`: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users (id) on delete cascade`, `created_at timestamptz not null default now()`. No `updated_at` — the table is append-only and never updated.
- Indexes: `(user_id, created_at desc)` for the per-user daily count, `(created_at desc)` for the global hourly count.
- RLS: `enable row level security` with **no policies whatsoever**. The app never reads or writes this table directly; all access is through the definer functions. Document this divergence from `subscriptions` (which grants select-own) in the migration header comment.
- Function `public.check_generation_quota(p_daily_limit int, p_hourly_ceiling int) returns text` — `security definer`, `stable`, `set search_path = public`. Returns `'user_daily'` when the caller's row count since the start of the current UTC day is `>= p_daily_limit`; else `'global_hourly'` when the product-wide count within `now() - interval '1 hour'` is `>= p_hourly_ceiling`; else `'ok'`. Raises when `auth.uid()` is null (defensive — the route guards auth first; the route's fail-open catch turns this into "allow" if it ever fires).
- Function `public.record_generation(p_daily_limit int) returns boolean` — `security definer`, `volatile`, `set search_path = public`. Inserts one row for `auth.uid()` **only if** that user's count for the current UTC day is below `p_daily_limit`; returns whether a row was written. Raises when `auth.uid()` is null. This conditional is what makes the ledger self-bounding — see Key Discoveries.
- Grants: `revoke all on function … from public;` then `grant execute … to authenticated;` for both functions. Being definer functions, the default `public` execute grant must be revoked explicitly.

The UTC day boundary is the one expression worth pinning exactly, because the obvious form is session-dependent:

```sql
created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
```

The hourly window is a plain rolling `created_at >= now() - interval '1 hour'` — no bucket table, no session dependency, and stricter than a fixed hour bucket (an attacker cannot straddle a boundary).

#### 2. Regenerated database types

**File**: `src/db/database.types.ts`

**Intent**: Pick up the new table and the two function signatures so the service layer is typed.

**Contract**: Regenerate with `npm run db:types` after `npm run db:reset`. Do not hand-edit.

#### 3. Quota service

**File**: `src/lib/services/generation-quota.ts` (new)

**Intent**: Wrap the two RPCs in a typed, HTTP-free service, mirroring `entitlements.ts` — throws on DB error and lets the caller decide the failure posture. Also owns limit resolution from env so the route stays declarative.

**Contract**:

- `export type QuotaVerdict = "ok" | "user_daily" | "global_hourly"`
- `export interface GenerationLimits { dailyLimit: number; hourlyCeiling: number }`
- `export const DEFAULT_DAILY_LIMIT = 100` and `export const DEFAULT_HOURLY_CEILING = 500`
- `getGenerationLimits(): GenerationLimits` — reads `GENERATION_DAILY_LIMIT` / `GENERATION_HOURLY_CEILING` from `astro:env/server`, falling back to the defaults when unset. Kept separate from the pure functions below so unit tests can exercise the logic without stubbing `astro:env`.
- `checkGenerationQuota(supabase, limits): Promise<QuotaVerdict>` — calls `check_generation_quota`, throws on `error`, narrows the returned string to `QuotaVerdict` (treat an unrecognized value as `"ok"` — an unknown verdict must not block a user).
- `recordGeneration(supabase, limits): Promise<boolean>` — calls `record_generation`, throws on `error`, returns the boolean.

#### 4. Env schema + example

**Files**: `astro.config.mjs`, `.env.example`

**Intent**: Make both limits tunable without a deploy, which is also what makes the Phase 3 E2E deterministic.

**Contract**: Two new entries in the `env.schema` block — `GENERATION_DAILY_LIMIT` and `GENERATION_HOURLY_CEILING`, both `envField.number({ context: "server", access: "public", optional: true })`. Defaults live in code, not in the schema, so an unset var and a misparsed var behave identically. Add both to `.env.example` with a comment naming the defaults and stating that these are abuse guards, not billing.

#### 5. Unit + contract tests

**File**: `src/lib/services/generation-quota.test.ts` (new)

**Intent**: Pin the verdict mapping and the failure posture of the service without requiring a database, following the hermetic-stub style of `entitlements.test.ts:19`.

**Contract**: Stub `.rpc()` per `entitlements.test.ts`'s `clientReturning` helper. Cover: each of the three verdicts round-trips; an unrecognized verdict string degrades to `"ok"`; a DB `error` throws; `recordGeneration` returns both boolean outcomes and throws on error; `getGenerationLimits` falls back to 100/500 when the env vars are absent.

#### 6. SQL-level verification

**File**: manual, via `npm run db:reset` + `psql`/Supabase Studio (recorded in Progress, not committed as a test)

**Intent**: Prove the two properties that unit tests with a stubbed client structurally cannot: RLS actually denies direct table access, and the conditional insert actually bounds the ledger.

**Contract**: As an `authenticated` role, `select` and `insert` on `public.generation_usage` are both denied. Calling `record_generation(2)` three times in a row returns `true, true, false` and leaves exactly two rows.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npm run db:reset`
- DB types regenerate with no diff beyond the new table/functions: `npm run db:types`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Unit tests pass: `npm test`

#### Manual Verification:

- Direct `select` and `insert` on `public.generation_usage` as `authenticated` are both denied by RLS
- `record_generation(2)` called three times returns `true, true, false` and leaves exactly 2 rows
- `check_generation_quota` returns `user_daily` once the caller is at the limit and `ok` below it
- The app is behaviorally unchanged — generate → edit → save → export still works end to end

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Route enforcement + localized wall + telemetry

### Overview

Wire the verdict into `POST /api/cv/generate`, introduce the `daily_limit_reached` error bucket with en/pl/ru copy, and emit the `generation_limit_reached` event. This is the phase where the feature becomes user-visible.

### Changes Required:

#### 1. New error bucket + localized copy

**File**: `src/lib/cv-draft-messages.ts`

**Intent**: Add the per-user wall as a first-class failure bucket so the existing client mapping localizes it automatically.

**Contract**: Extend `GenerationErrorBucket` with `"daily_limit_reached"`, and add the string to `generationErrorMessages` (English, also used as the server-side `message` field) and to the `pl` / `ru` branches of `generationErrorMessagesByLocale`. The `satisfies Record<UiLocale, Record<GenerationErrorBucket, string>>` constraint at the bottom of the file will fail the build if any locale is missed — that is the intended safety net.

Copy must be number-free and must read correctly with `" You can try again — your answers are kept."` appended (`QuestionnaireFlow.tsx:335`). English: *"You've reached today's CV generation limit. Please try again tomorrow."* Polish and Russian equivalents follow the register already used in this file.

#### 2. Observability contract widening

**Files**: `src/lib/observability/index.ts`, `src/lib/observability/scrub.ts`

**Intent**: Make limit refusals visible, so a real attack is distinguishable from a mis-set ceiling and the 500/hour guess can eventually be validated against data.

**Contract**: Add `"generation_limit_reached"` to the `ObservabilityEvent` union (`index.ts:11`), alongside the existing non-funnel `"feedback_submitted"`. Add `"limit_kind"` to `allowedPropertyKeys` in `scrub.ts` — without this the property is silently dropped and the event is useless. The event carries only `limit_kind` (`"user_daily"` | `"global_hourly"`) and `locale`; no user identifier beyond the pseudonymous `distinct_id` `track()` already attaches.

#### 3. Route enforcement

**File**: `src/pages/api/cv/generate.ts`

**Intent**: Refuse over-limit requests before they cost anything, record successful ones, and never let the counter's own health affect the user's ability to generate.

**Contract**:

- Create a Supabase client with `createClient(context.request.headers, context.cookies)` (the pattern already used at `src/pages/api/cv/feedback.ts:44`). A null client (unconfigured Supabase) means **skip the gate entirely** — fail open.
- Insert the check **between the zod `safeParse` block (`:43`) and the `OPENAI_API_KEY` check (`:48`)**. This ordering is load-bearing: it keeps quota refusals independent of provider configuration, which is what makes the Phase 3 E2E work without an API key.
- `user_daily` → HTTP **429**, `{ ok: false, error: "daily_limit_reached", message: generationErrorMessages.daily_limit_reached }`.
- `global_hourly` → HTTP **503**, `{ ok: false, error: "service_unavailable", message: generationErrorMessages.service_unavailable }` — the existing bucket, deliberately (see Critical Implementation Details).
- Both refusal paths `await track("generation_limit_reached", { limit_kind, locale: context.locals.locale }, context.locals.observability)` before returning.
- A throw from `checkGenerationQuota` is caught, passed to `reportError` with an `error_location`, and **falls through to generation**.
- After the existing success branch mints `generationEventId` (`:63`), call `recordGeneration` inside a try/catch that reports and swallows. Whether it returns `true` or `false` does not change the response — the draft is already built and the user gets it.

#### 4. Route contract tests

**File**: `src/pages/api/cv/generate.test.ts`

**Intent**: Pin every branch of the new gate, including the two failure postures that are easy to regress into "fail closed".

**Contract**: Extend the existing suite (which already stubs the generation service and `track` at `:31`). Cover: `user_daily` → 429 with the `daily_limit_reached` bucket and no provider call; `global_hourly` → 503 with the `service_unavailable` bucket and no provider call; both emit `generation_limit_reached` with the right `limit_kind`; a throwing check still generates (fail-open) and reports the error; a successful generation calls `recordGeneration` exactly once; a throwing `recordGeneration` still returns 200 with the draft; `ok` verdict leaves the existing response shape untouched.

#### 5. Copy coverage

**File**: `src/lib/cv-draft-messages` coverage — extend the nearest existing copy test (`src/lib/cv-feedback-copy.test.ts` is the shape precedent) or add `src/lib/cv-draft-messages.test.ts`

**Intent**: Guarantee the new bucket resolves to non-empty, distinct copy in all three locales rather than silently falling back.

**Contract**: For each of en/pl/ru, `getGenerationErrorMessages(locale).daily_limit_reached` is non-empty, differs from `service_unavailable`, and contains no digits (enforcing the number-free rule so a future edit cannot reintroduce a hardcoded "100").

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Unit + contract tests pass: `npm test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- With `GENERATION_DAILY_LIMIT=1`, the second generation returns 429 and the questionnaire shows the localized wall message in en, pl, and ru
- With `GENERATION_HOURLY_CEILING=0`, generation is refused with the ordinary "temporarily unavailable" message (not the daily-limit message)
- With Supabase stopped, generation still works — the gate fails open rather than blocking
- `public.generation_usage` gains exactly one row per successful generation and none for failed ones
- PostHog receives `generation_limit_reached` with `limit_kind` and `locale` and no other properties
- At default limits the ordinary generate → edit → save → export flow is unchanged

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: E2E verification of the user-facing wall

### Overview

Prove in a real browser that an over-limit generation surfaces the localized wall message to the user — the one thing server-side tests structurally cannot cover.

### Changes Required:

#### 1. Dedicated quota-limited dev server

**File**: `playwright.config.ts`

**Intent**: Give the limit spec a server whose quota is exhausted from the first request, without touching the shared server that `e2e/post-generation-feedback.spec.ts:46` needs at normal limits.

**Contract**: `webServer` becomes an array of two entries. The existing one is unchanged on port 4321. The second boots the same dev command on **port 4322** with `env: { GENERATION_DAILY_LIMIT: "0" }`. With the limit at 0 the pre-flight check refuses immediately, so the spec needs no OpenAI key, spends nothing, and cannot interfere with any other spec.

> **Deviation as built (2026-08-07).** The two-entry `webServer` array was implemented and rejected on evidence: both dev servers boot simultaneously, and on a cold Vite cache their concurrent dependency optimization + first-compile starved each other badly enough that `e2e/legal-pages.spec.ts` (first compile of `/terms`, `/privacy`) exceeded the 30 s test timeout — twice, reproducibly, while the same suite was green on the pre-change baseline. Giving the second server its own `cacheDir` did not help, so the cause is CPU contention, not cache collision. Shipped instead as a **second Playwright config**, `playwright.quota.config.ts`, owning that one spec on port 4322; the main config `testIgnore`s it and `npm run test:e2e` chains the two (`playwright test && npm run test:e2e:quota`). The servers therefore never overlap and the pre-existing suite keeps its original timing. Everything else in this phase is as planned.

Auth carries over for free: cookies are not port-scoped, so the `storageState` written by `e2e/auth.setup.ts` against `localhost:4321` is sent to `localhost:4322`, and both servers talk to the same local Supabase.

#### 2. Limit spec

**File**: `e2e/daily-generation-limit.spec.ts` (new)

**Intent**: Drive the real questionnaire against the quota-limited server and assert the user sees the wall.

**Contract**: `test.use({ baseURL: "http://localhost:4322" })` to pin the spec to the limited server. **Do not** `page.route` the generate endpoint — the whole point is that the real server refuses. Reuse the step-navigation shape from `e2e/post-generation-feedback.spec.ts:28-43` (fill the two required fields by their accessible labels, `Next` ×3, `Review answers`, `Generate draft`), then assert the `role="alert"` panel becomes visible and contains the English `daily_limit_reached` copy. Assert via `getByRole`/`getByText` per the project locators rule; no `waitForTimeout`.

Cleanup is a no-op — nothing is persisted, since a refused generation writes no ledger row and creates no CV.

Read `e2e/README.md` before writing this spec, per CLAUDE.md.

**Scope note to record in the spec header**: with the limit at 0, this proves *the wall renders and is localized*, not *the counting arithmetic*. Counting correctness is owned by the Phase 1 SQL verification and the Phase 2 contract tests. This split is deliberate — driving a real 100-generation count through a browser would cost 100 OpenAI calls.

### Success Criteria:

#### Automated Verification:

- E2E suite passes with local Supabase up: `npm run db:start` then `npm run test:e2e`
- The pre-existing specs still pass unchanged against port 4321 — in particular `e2e/post-generation-feedback.spec.ts`, which makes a real generation call
- Linting passes: `npm run lint`

#### Manual Verification:

- The new spec fails if the `daily_limit_reached` copy is removed (the assertion is real, not vacuous)
- Both dev servers boot cleanly in a cold `npm run test:e2e` run

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before closing out the change.

---

## Testing Strategy

### Unit Tests:

- Verdict mapping for all three outcomes plus the unknown-string degradation to `"ok"`
- `getGenerationLimits` env fallback to 100 / 500
- Both service functions throw on DB error (the route, not the service, owns fail-open)
- All three locales resolve `daily_limit_reached` to distinct, digit-free copy

### Integration Tests:

- Route contract: 429 / 503 / fail-open-on-throw / record-on-success / record-throw-still-200 / unchanged happy path
- Telemetry: `generation_limit_reached` emitted with exactly `limit_kind` + `locale`
- SQL-level: RLS denies direct table access; `record_generation` bounds the ledger at the cap

### Manual Testing Steps:

1. Set `GENERATION_DAILY_LIMIT=1`, generate twice — second attempt shows the wall message; switch locale to pl and ru and repeat
2. Set `GENERATION_HOURLY_CEILING=0` — generation refused with the "temporarily unavailable" message, not the daily one
3. Stop Supabase, generate — succeeds (fail-open), error reported
4. Restore defaults, run the full flow — unchanged
5. Inspect `public.generation_usage` — one row per success, zero for failures

## Performance Considerations

The gate adds one round-trip to Postgres on the generation path. Against a call that already takes seconds of LLM latency, a single indexed `count(*)` is negligible. Both counts are index-backed: `(user_id, created_at desc)` for the daily count and `(created_at desc)` for the hourly one. The hourly count scans at most the rows written in the last hour, which the ceiling itself bounds at 500.

## Migration Notes

- **Additive only**, per PRD `:310` — a new table and two new functions. Nothing existing is altered; `public.cvs`, `public.subscriptions`, and `public.feedback` are untouched.
- **No backfill.** An absent row set means zero usage, which is the correct starting state for every existing account.
- **Rollback** is `drop function` ×2 + `drop table public.generation_usage cascade`, plus reverting the route. There is no data anyone depends on.
- **Erasure (S-08)** is covered for free by `on delete cascade` from `auth.users` — account deletion removes the ledger rows with no extra work in that slice.
- **Retention**: rows accumulate unboundedly but slowly — the hourly ceiling caps growth at ~12k rows/day worst case, and realistic volume is orders of magnitude below that. Pruning is deliberately out of scope; revisit only if the table becomes large enough to affect the indexed counts.

## References

- Roadmap slice: `context/foundation/roadmap.md` — S-06 (§ Slices), resolves Open Roadmap Question 5
- Requirement: `context/foundation/prd-v3.md:264` (FR-012), `:318` (billing scaffolding stays inert), `:342` (NFR "Generation availability")
- Gate precedent (RLS + DB-clock authority): `supabase/migrations/20260609132956_create_subscriptions.sql`
- Service-layer shape: `src/lib/services/entitlements.ts:34`, tests `src/lib/services/entitlements.test.ts:19`
- Non-funnel event precedent: `src/lib/observability/index.ts:11` (`feedback_submitted`)
- Client bucket localization (why no UI change is needed): `src/components/cv/QuestionnaireFlow.tsx:83`
- E2E conventions: `e2e/README.md`; real-generation spec to avoid disturbing: `e2e/post-generation-feedback.spec.ts:46`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Quota ledger + server-authoritative verdict

#### Automated

- [x] 1.1 Migration applies cleanly (`npm run db:reset`) — 050e479
- [x] 1.2 DB types regenerate cleanly (`npm run db:types`) — 050e479
- [x] 1.3 Type checking passes (`npm run typecheck`) — 050e479
- [x] 1.4 Linting passes (`npm run lint`) — 050e479
- [x] 1.5 Unit tests pass (`npm test`) — 050e479

#### Manual

- [x] 1.6 RLS denies direct `select` and `insert` on `public.generation_usage` — 050e479
- [x] 1.7 `record_generation(2)` ×3 returns `true, true, false` and leaves 2 rows — 050e479
- [x] 1.8 `check_generation_quota` returns `user_daily` at the cap, `ok` below it — 050e479
- [x] 1.9 App behaviorally unchanged end to end — 050e479

### Phase 2: Route enforcement + localized wall + telemetry

#### Automated

- [x] 2.1 Type checking passes (`npm run typecheck`) — 518b1e2
- [x] 2.2 Linting passes (`npm run lint`) — 518b1e2
- [x] 2.3 Unit + contract tests pass (`npm test`) — 518b1e2
- [x] 2.4 Production build succeeds (`npm run build`) — 518b1e2

#### Manual

- [x] 2.5 Second generation at `GENERATION_DAILY_LIMIT=1` shows the localized wall in en, pl, ru — 518b1e2
- [x] 2.6 `GENERATION_HOURLY_CEILING=0` refuses with the "temporarily unavailable" message — 518b1e2
- [x] 2.7 Generation still works with Supabase stopped (fail-open) — 518b1e2
- [x] 2.8 One ledger row per successful generation, none for failures — 518b1e2
- [x] 2.9 PostHog `generation_limit_reached` carries only `limit_kind` + `locale` — 518b1e2
- [x] 2.10 Default-limit flow generate → edit → save → export unchanged — 518b1e2

### Phase 3: E2E verification of the user-facing wall

#### Automated

- [x] 3.1 E2E suite passes (`npm run test:e2e`)
- [x] 3.2 Pre-existing specs still pass on port 4321, including the real-generation spec
- [x] 3.3 Linting passes (`npm run lint`)

#### Manual

- [x] 3.4 The new spec fails when the `daily_limit_reached` copy is removed
- [x] 3.5 Both dev servers boot cleanly in a cold E2E run
