# Daily Generation Limit + Aggregate Abuse Guard (S-06 / FR-012) — Plan Brief

> Full plan: `context/changes/daily-generation-limit/plan.md`

## What & Why

Enforce a server-authoritative limit of **100 CV generations per user per UTC day**, plus a coarse **product-wide ceiling of 500 successful generations per rolling hour** covering the cross-account cost vector. Today `POST /api/cv/generate` has no protection beyond a 40 KB body cap — anyone with an account can drive unbounded LLM spend, and creating more accounts multiplies it. This is the last launch-safety gate before the release can be put in front of real users.

The governing constraint from the PRD: this is **abuse protection, not a paywall**. It must never block a legitimate user under normal use — which is why the design fails open, counts only successes, and shows no quota UI.

## Starting Point

`src/pages/api/cv/generate.ts` guards auth and body size, then calls OpenAI directly. There is no usage store, no counter, and no Supabase client in the route at all. A strong precedent exists though: `public.subscriptions` already demonstrates the "RLS with no write policy + Postgres function as the authority" pattern that makes a gate unbypassable from the client. It just can't be reused — the PRD explicitly forbids building this on the dormant billing scaffolding.

## Desired End State

A user who has produced 100 successful generations today sees a clear localized message in the questionnaire's existing error panel telling them to try again tomorrow, with their answers preserved and no OpenAI call made. If the product as a whole exceeds 500 successful generations in an hour, generation is refused product-wide with the ordinary "temporarily unavailable" message until volume subsides. Both refusals emit an analytics event carrying only the limit kind and locale. If the counter itself is unreachable, generation proceeds normally and the failure is reported.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| What counts | Successful generations only | Matches FR-012's wording; a user hitting a bad streak of failures isn't punished for the product's own errors | Plan |
| Day boundary | UTC calendar day, evaluated in Postgres | One unambiguous clock, matching the existing `get_entitlement()` precedent; a client-supplied timezone would make the gate skewable | Plan |
| Aggregate guard | Global 500 generations/rolling hour | Caps the cross-account vector regardless of how many accounts an attacker creates, with no new identity data collected | Plan |
| Counter failure | Fail open — allow and report | A Supabase blip must not take down the core feature; abuse during a rare outage is cheaper than a broken funnel | Plan |
| Aggregate refusal message | Reuse `service_unavailable` (503) | Accurate for the user, and doesn't confirm to an attacker that they found the global guard | Plan |
| Quota visibility | None — message only at the wall | Showing "12/100 used" makes a free product feel metered, exactly the wrong signal during funnel validation | Plan |
| Telemetry | One `generation_limit_reached` event, both limit kinds | Without it the 500/hour guess stays unvalidated and a real attack is indistinguishable from a mis-set ceiling | Plan |
| Limits configurable | Env-tunable, defaults in code | Retuning during a launch spike becomes config, not a deploy — and it makes the E2E wall test deterministic | Plan |

## Scope

**In scope:** `public.generation_usage` ledger + two `security definer` functions; typed quota service; enforcement in the generate route; new `daily_limit_reached` error bucket in en/pl/ru; `generation_limit_reached` analytics event; unit, contract, and one E2E path.

**Out of scope:** IP tracking or storage; new-account throttle; signup throttle (PRD Open Q5's second half); quota display or remaining-count endpoint; any use of `subscriptions`/`entitlements.ts`; Cloudflare-level rate limiting; admin surface; retention/pruning job.

## Architecture / Approach

One append-only ledger row per successful generation — `(user_id, created_at)`, no content. Both limits are `count(*)` reads over that single table, wrapped in two `security definer` Postgres functions (necessary because the hourly ceiling must count across users that RLS would otherwise hide, and no service-role key exists in this project). RLS is enabled with **no policies at all**, so the table is reachable only through those functions.

The route becomes **check → generate → record**: the check runs after schema validation but before the OpenAI call so a blocked user costs nothing, and the record only lands on success. The client needs no changes — `QuestionnaireFlow.tsx` already localizes arbitrary error buckets with a safe fallback, so adding the bucket and its three strings makes the wall appear.

Two subtleties worth knowing before reading the plan:

- **`record_generation` enforces the per-user cap itself.** The function must be executable by `authenticated` (no privileged client exists), so without a self-check an attacker could cheaply insert 500 rows over PostgREST and trip the *global* ceiling for everyone — the guard would become a DoS vector. Bounding the insert also means the ledger can never exceed the cap under concurrency.
- **Quota check sits before the `OPENAI_API_KEY` check.** A quota refusal has nothing to do with provider config, and this ordering is what lets the E2E test the wall with no API key and no LLM spend.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Quota ledger + verdict | Migration, two SQL functions, typed service, env config — nothing user-visible yet | The SQL day-boundary expression is session-dependent if written the obvious way; RLS-with-no-policies must be verified, not assumed |
| 2. Route enforcement + wall + telemetry | 429/503 refusals, en/pl/ru copy, `generation_limit_reached` event | Fail-open is easy to regress into fail-closed; the scrub allowlist silently drops `limit_kind` if forgotten |
| 3. E2E verification | Playwright spec proving the localized wall reaches the user | Needs a second dev server on port 4322 so it can't disturb the one existing spec that makes a real OpenAI call |

**Prerequisites:** F-02 (core-flow regression net) — done. Local Supabase running for phases 1 and 3.
**Estimated effort:** ~3 sessions, one per phase.

## Open Risks & Assumptions

- **500/hour is a guess.** No traffic data exists to ground it. It sits far above realistic pre-launch volume, but the only signal it's mis-set is the alert firing — the telemetry event exists specifically so this can be revisited with real numbers.
- **Accepted race:** concurrent requests can all pass the same pre-flight check and proceed. The ledger stays correct (the conditional insert refuses overflow), so the over-grant is bounded by in-flight concurrency and self-corrects. Reserve-then-confirm was rejected as disproportionate given fail-open already accepts a larger leak by design.
- **E2E proves the wall renders, not the arithmetic.** With the limit at 0, counting correctness is covered by the SQL and contract tests instead — driving a real 100-generation count through a browser would cost 100 OpenAI calls.
- The S-05 lesson warns the E2E harness tends to need repair when a new spec exercises it; budget time in Phase 3.

## Success Criteria (Summary)

- A user at the cap sees a clear, localized "try again tomorrow" message with their answers preserved — and no OpenAI call is made
- A user under the cap notices nothing at all; the generate → edit → save → export flow is unchanged
- The limit cannot be bypassed from the browser, and a counter outage degrades to "allow", never to "blocked"
