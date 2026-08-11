# Observability Baseline (F-01) — Plan Brief

> Full plan: `context/changes/observability-baseline/plan.md`

## What & Why

Provision one managed observability tool — **PostHog (EU Cloud)** — for both product analytics and error monitoring, and build a reusable, privacy-first recording contract. This is roadmap slice F-01: the foundation that unlocks the north-star funnel events (S-01), feedback (S-05), centralized error monitoring (S-07), and analytics-PII purge (S-08). The load-bearing risk it exists to retire: never let raw answers/prompts/draft/CV content leak into a third-party store — so the scrub + pseudonymity contract is established here, once.

## Starting Point

Observability is a clean slate: only two ad-hoc `console.warn` calls, no analytics, no error monitor, no logging library. `wrangler.jsonc` has Cloudflare's built-in Worker logs enabled but nothing product-level. The codebase already forbids logging raw content (privacy rule in `cv-generation.ts` / `cv-repository.ts`), and there's an existing config-banner pattern (`config-status.ts` + `Layout.astro`) and a Workers-safe `fetch` emit pattern (`cv-generation.ts`) to reuse.

## Desired End State

A PostHog EU project is provisioned; `src/lib/observability/` exposes `track()` and `reportError()` that emit cookieless over `fetch`, attach a pseudonymous identifier, and pass every payload through an allowlist scrubber. A minimal cookieless client init + browser error-hook scaffold is wired into the root layout (no funnel events yet). A guarded smoke trigger proves one event + one error reach PostHog from server and client — content-free. Absent config = safe no-op + banner.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Managed tool(s) | PostHog (EU Cloud), one tool for both | One vendor/secret/scrub surface covers FR-008 + FR-009; HTTP capture works on Workers; EU region for GDPR | Plan |
| Identifier model | Derived per-user pseudonymous ID (HMAC) + anon session ID | Stable across a user's events, recomputable for S-08 purge, raw user id never leaves; no stored mapping table | Plan |
| Surfaces in baseline | Server contract + client init scaffold | S-01 (server-emitted) and S-07 (browser capture) both plug in; proves both directions now | Plan |
| Consent posture | Cookieless / pseudonymous, no banner | Keeps F-01 shippable without consent UI (that's S-03); aligns with content-free commitment | Plan / PRD Open Q3 |
| Proof-of-life | One smoke event + one test error (server + client) | Verifies keys, EU host, scrubbing, IDs end-to-end before downstream slices depend on it | Plan |
| Privacy mechanism | Allowlist scrubber (drop-by-default) | A denylist fails open; only enumerated keys can ever be emitted | Plan / F-02 rule |

## Scope

**In scope:** PostHog EU provisioning + secrets/docs; pseudonymous identifier; allowlist scrubber; `track`/`reportError` server contract; cookieless client init + error-hook scaffold; guarded smoke test; no-op-when-unconfigured.

**Out of scope:** the 8 funnel events (S-01); full 4-surface error coverage (S-07); feedback (S-05); account/analytics deletion (S-08); cookie consent banner (S-03); custom dashboards; touching the existing `console.warn` calls.

## Architecture / Approach

New `src/lib/observability/` module is the single contract everything downstream imports. Server is the primary emit path (best-effort, time-boxed `fetch` to PostHog EU, fire-and-forget). Privacy is structural: emission helpers accept only allowlisted property keys and drop the rest, and the per-user id is an HMAC of the Supabase user id (recomputable for erasure, never raw). The client gets a minimal cookieless init + `window` error hook reusing the same scrub. A debug-guarded smoke route + client function validate the chain against the real project.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Configuration & provisioning | Env schema + config banner + docs; PostHog EU project | Secrets diverging across `.env`/`.dev.vars`/Workers |
| 2. Server recording contract | `track`/`reportError`, identifier, allowlist scrubber + tests | Scrubber failing open / leaking content or raw user id |
| 3. Client init + error hook | Cookieless browser init + error scaffold in layout | Cookies set despite cookieless intent; bundle weight |
| 4. Proof-of-life smoke | One event + one error to PostHog, server + client | Smoke trigger reachable in production |

**Prerequisites:** A PostHog EU Cloud account (human provisioning of the project + keys). No code prerequisites — F-01 has no upstream dependencies.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- Tool choice was deferred to planning (roadmap Open Q7); PostHog EU is now chosen — assumes its Workers HTTP capture + cookieless mode behave as documented.
- GDPR posture assumes cookieless pseudonymous tracking avoids a consent banner (PRD Open Q3); revisit if legal review disagrees.
- Rotating `OBSERVABILITY_ID_SALT` re-pseudonymizes all users — acceptable for a baseline, noted in Migration Notes.

## Success Criteria (Summary)

- A content-free smoke event and a test error reach the PostHog EU project from both server and client, carrying only a pseudonymous/session id.
- Unit tests prove the scrubber drops every disallowed key and the identifier never equals the raw user id.
- With PostHog unconfigured, the app runs normally, emission is a no-op, and the config banner flags it.
