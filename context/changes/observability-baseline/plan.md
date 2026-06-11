# Observability Baseline (F-01) Implementation Plan

## Overview

Provision a single managed observability tool — **PostHog (EU Cloud)** — for both product analytics and error monitoring, and establish a **reusable, privacy-first recording contract** in `src/lib/observability/`. The contract emits over `fetch` (Workers-safe, cookieless), carries only a pseudonymous user/session identifier plus coarse allowlisted metadata, and **never** lets raw answers, prompts, or draft/CV content leave the product.

This is roadmap slice **F-01** — a *foundation* that unlocks S-01 (funnel events), S-05 (feedback), S-07 (4-surface error coverage), and S-08 (analytics PII purge). It deliberately stops at "provision + contract + smoke test"; it does **not** instrument the 8 funnel events or wire all 4 error surfaces.

## Current State Analysis

- **Observability is a clean slate.** The only logging in the repo is two ad-hoc `console.warn` calls: `src/lib/supabase.ts:62` and `src/pages/api/auth/signout.ts:12`. No logging library, no analytics, no error monitor.
- **`wrangler.jsonc`** has `observability.enabled: true` (Cloudflare's built-in Worker logs) but no logpush, analytics-engine binding, or tail consumers — i.e. no product-level instrumentation.
- **Privacy is already load-bearing in code.** `src/lib/services/cv-generation.ts:12-13` and `src/lib/services/cv-repository.ts:17` forbid logging raw answers/prompts/draft content (PRD privacy NFR / F-02). The new contract must honor this.
- **Runtime constraint:** server code runs on Cloudflare Workers (workerd), not Node. Emission must use `fetch` with no Node-only SDKs — the existing pattern is `src/lib/services/cv-generation.ts` (plain `fetch`, `AbortController` timeout, Bearer header).
- **Env pattern:** secrets are declared in `astro.config.mjs` `env.schema` and imported from `astro:env/server` (e.g. `src/pages/api/cv/generate.ts:2`, `src/lib/supabase.ts:4`). All current secrets are `optional: true`.
- **Config-surfacing pattern exists:** `src/lib/config-status.ts` enumerates required config and `src/layouts/Layout.astro:29-45` renders a banner for anything missing.
- **API response idiom:** each route defines a local `json()` helper returning a `{ ok, ... }` discriminated union; there is no shared response/error utility.
- **Test conventions:** Vitest, files co-located as `src/**/*.test.ts` (e.g. `src/lib/cv-export-error.test.ts`, `src/lib/supabase.test.ts`); `@/*` alias mirrored in `vitest.config.ts`.

## Desired End State

After this plan:

- A PostHog EU Cloud project exists; its keys are documented as Worker secrets and in `.env.example` / `.dev.vars`, and declared in the astro env schema.
- `src/lib/observability/` exposes a stable, reusable contract: `track(event, props)` and `reportError(error, context)` (server) that emit to PostHog EU over `fetch`, attach a pseudonymous identifier, and pass every payload through an **allowlist** scrubber so no raw content can be sent.
- A minimal cookieless PostHog **client** init + a browser `error` / `unhandledrejection` hook scaffold are wired into `Layout.astro`, reusing the same pseudonymous-ID and scrub contract — ready for S-01/S-07 to extend, with no funnel events emitted yet.
- A guarded debug trigger demonstrates one content-free smoke event and one deliberate test error reaching PostHog from both server and client, proving the pipeline end-to-end.
- When PostHog is not configured, emission is a safe no-op (mirroring how Supabase-absent is handled), and the config banner flags it.

**Verification:** the smoke trigger produces exactly one event and one error in the PostHog EU project, both free of any answer/prompt/draft content; unit tests prove the scrubber drops disallowed keys; `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all pass.

### Key Discoveries:

- Follow `src/lib/services/cv-generation.ts` for the Workers-safe `fetch` emit pattern (timeout via `AbortController`, no Node SDK).
- Reuse the `src/lib/config-status.ts` + `Layout.astro` banner pattern for "PostHog not configured."
- Pseudonymous per-user ID = HMAC(server secret, supabase user id) — deterministic so S-08 can recompute and purge by id without a stored mapping; the raw user id never leaves.
- PostHog EU ingest host is `https://eu.i.posthog.com` (capture endpoint `POST /i/v0/e/` or batch) — content-free `fetch`, cookieless persistence on the client.

## What We're NOT Doing

- **Not** instrumenting the 8 funnel events (that is S-01).
- **Not** wiring all four error surfaces end-to-end (that is S-07) — F-01 provides the `reportError` contract + client hook scaffold + a smoke proof, not exhaustive call-site coverage.
- **Not** building feedback capture (S-05) or account/analytics deletion (S-08) — only designing the identifier so S-08 *can* purge.
- **Not** adding a cookie consent banner — baseline is cookieless/pseudonymous (PRD Open Q3); consent UI is S-03 territory.
- **Not** building custom analytics/monitoring infrastructure or dashboards (PRD Non-Goal) — PostHog is the managed sink.
- **Not** migrating or replacing the two existing `console.warn` calls.

## Implementation Approach

One managed vendor (PostHog EU) covers both FR-008 and FR-009, minimizing secrets and scrub surface. The privacy guarantee is enforced structurally by an **allowlist** scrubber: emission helpers accept only a typed, enumerated set of property keys and silently drop anything else, so a future careless caller cannot leak content even by accident. The pseudonymous identifier is *derived* (HMAC) rather than stored, so it is stable across a user's events yet recomputable for S-08 erasure. Server is the primary emit path (it can see failures the client can't and keeps content server-side); the client gets a minimal cookieless init + error hook scaffold so S-07's frontend surface plugs in without new bootstrapping. A guarded smoke trigger validates the whole chain — keys, EU host, scrubbing, identifier — before any downstream slice depends on it. Absent configuration degrades to a no-op, matching the repo's existing Supabase-absent behavior.

## Critical Implementation Details

- **Allowlist, not denylist.** The scrubber must accept a fixed set of property keys and drop everything else. A denylist of "known sensitive fields" is rejected — it fails open. This is the load-bearing privacy mechanism (PRD FR-008/FR-009, F-02 rule).
- **Server emit must not block the response.** Emission is best-effort: failures (network, non-2xx, timeout) are swallowed and never surface to the user or throw into a request path. Use a short `AbortController` timeout like `cv-generation.ts`. On Workers, prefer `ctx.waitUntil`-style fire-and-forget where an execution context is available; otherwise an awaited best-effort `fetch` with try/catch.
- **Pseudonymous ID secret.** The HMAC key is a new server secret (`OBSERVABILITY_ID_SALT` or similar). If absent, fall back to treating the user as anonymous (session-only) rather than emitting a raw user id — never emit the raw Supabase user id.
- **No-op when unconfigured.** If the PostHog key is absent, `track`/`reportError` return immediately. The client init must not load or attach when unconfigured.

## Phase 1: Configuration & Provisioning

### Overview

Declare PostHog configuration, surface it through the existing config-status banner, document the EU project and Worker secrets, and provision the project (human step).

### Changes Required:

#### 1. Env schema

**File**: `astro.config.mjs`

**Intent**: Declare the PostHog server keys and the ID salt so they're available via `astro:env/server`, and the public PostHog client key/host for the browser init.

**Contract**: Add to `env.schema` (all `optional: true`, matching existing entries): `POSTHOG_API_KEY` (server, secret), `POSTHOG_HOST` (server, public — defaults to `https://eu.i.posthog.com`), `OBSERVABILITY_ID_SALT` (server, secret), and a client-readable `PUBLIC_POSTHOG_KEY` (client, public) + `PUBLIC_POSTHOG_HOST` (client, public) for the browser init. Use `envField` per the existing pattern.

#### 2. Config-status banner

**File**: `src/lib/config-status.ts`

**Intent**: Add a "PostHog" entry so a missing key is surfaced the same way Supabase is, and emission can safely no-op.

**Contract**: Append a `ConfigStatus` with `name: "PostHog"`, `configured: Boolean(POSTHOG_API_KEY)`, a message consistent with the existing Polish copy, and an optional docs link. Imported keys come from `astro:env/server`.

#### 3. Local-dev + secret documentation

**File**: `.env.example`, `.dev.vars` (example), `README.md` (or `CLAUDE.md` env section)

**Intent**: Document the new variables for Node dev (`.env`), Workers local dev (`.dev.vars`), and production Worker secrets, so the deploy checklist stays complete (health-check.md flags this gap).

**Contract**: Mirror the new keys in `.env.example`; note the `npx wrangler secret put POSTHOG_API_KEY` / `OBSERVABILITY_ID_SALT` steps and the EU host default. No real secrets committed.

#### 4. PostHog EU project (human/manual)

**Intent**: Create the PostHog EU Cloud project and obtain the project API key + public key.

**Contract**: Manual provisioning step; record the project region (EU) and keys in the team's secret store. Not a code change — captured in Manual Verification.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes with new env fields: `npm run build`

#### Manual Verification:

- PostHog EU Cloud project exists and keys are stored as Worker secrets.
- With PostHog unconfigured locally, the app loads and shows the config banner; with it configured, the banner is absent.

---

## Phase 2: Server-Side Recording Contract

### Overview

Build the reusable `src/lib/observability/` module: pseudonymous identifier derivation, allowlist scrubber, and `track()` / `reportError()` emitting to PostHog EU over `fetch`.

### Changes Required:

#### 1. Identifier model

**File**: `src/lib/observability/identity.ts`

**Intent**: Produce a stable pseudonymous per-user ID and an anonymous session ID without ever emitting raw user data.

**Contract**: `getPseudonymousUserId(userId: string): Promise<string>` = hex HMAC-SHA256 of the Supabase user id keyed by `OBSERVABILITY_ID_SALT`, using Web Crypto (`crypto.subtle`, Workers-safe). `getAnonSessionId(cookies): string` reads/mints a random first-party session id (cookieless persistence — short-lived, non-tracking). If the salt is absent, return null for the user id (caller falls back to session-only). No stored mapping table — derivation is recomputable for S-08 purge.

#### 2. Allowlist scrubber

**File**: `src/lib/observability/scrub.ts`

**Intent**: Guarantee structurally that only enumerated, non-sensitive property keys can be emitted.

**Contract**: An exported readonly allowlist of permitted property keys (e.g. `surface`, `route`, `status`, `error_type`, `error_location`, `duration_ms`, `model_provider`, `locale`, etc.). `scrub(props): SafeProps` returns a new object containing only allowlisted keys with primitive values, dropping everything else. Reject/omit nested objects and strings over a small length cap. Default behavior: drop, never pass-through.

#### 3. Emit core + public contract

**File**: `src/lib/observability/index.ts` (and a small `client.ts` PostHog REST wrapper)

**Intent**: Provide the two reusable functions every downstream slice will call, emitting cookieless to PostHog EU and degrading to a no-op when unconfigured.

**Contract**:
- `track(event: ObservabilityEvent, props?: TrackProps, identity?: Identity): Promise<void>` — builds a PostHog capture payload (`event`, `distinct_id` = pseudonymous user id or session id, `properties` = `scrub(props)`), `POST`s to `${POSTHOG_HOST}/i/v0/e/` with the project key, best-effort with an `AbortController` timeout, all errors swallowed.
- `reportError(error: unknown, context: ErrorContext, identity?: Identity): Promise<void>` — derives `error_type` + `error_location` + allowlisted context (no message bodies/stack content beyond a scrubbed class/location), emits via PostHog's exception/event capture, same best-effort semantics.
- `ObservabilityEvent` is a string-literal union seeded with `"observability_smoke"`; downstream slices extend it.
- Shared types (`Identity`, `TrackProps`, `ErrorContext`, `ObservabilityEvent`) live here or in `src/types.ts` per convention.

#### 4. Unit tests

**File**: `src/lib/observability/scrub.test.ts`, `src/lib/observability/identity.test.ts`

**Intent**: Lock the privacy guarantee and identifier properties.

**Contract**: Scrub tests assert that disallowed keys (e.g. `answers`, `prompt`, `draft`, `content`, arbitrary unknown keys) are dropped and only allowlisted keys survive; that oversize strings/nested objects are removed. Identity tests assert HMAC is deterministic for the same input, differs across users, never equals the raw user id, and that a missing salt yields null (no raw id leak). Emission with no key configured is a no-op (no `fetch` call) — mock `fetch`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Scrub test proves no disallowed key can be emitted: `npm test src/lib/observability/scrub.test.ts`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification:

- Code review confirms allowlist (not denylist) semantics and that raw user id / content cannot reach `fetch`.
- Emission is best-effort: a forced PostHog failure does not throw into or slow a request path.

---

## Phase 3: Client Init Scaffold + Browser Error Hook

### Overview

Add a minimal cookieless PostHog browser init and a `window` error/unhandledrejection hook scaffold, wired into the root layout, reusing the same scrub contract — without emitting any funnel events.

### Changes Required:

#### 1. Client init

**File**: `src/lib/observability/client.browser.ts`

**Intent**: Initialize PostHog in the browser in cookieless mode so S-01/S-07 can emit/capture without re-bootstrapping; no-op when the public key is absent.

**Contract**: Initialize `posthog-js` (added as a dependency) with `persistence: "memory"` (cookieless), the `PUBLIC_POSTHOG_HOST` (EU), `autocapture: false`, and no funnel events. Expose a small typed wrapper (`trackClient`, `reportErrorClient`) that routes through the **same** allowlist scrub before capture. Guarded so it only runs when configured.

#### 2. Browser error hook scaffold

**File**: `src/lib/observability/client.browser.ts` (same module)

**Intent**: Attach `window.addEventListener("error" | "unhandledrejection")` handlers that forward a scrubbed error_type/location to PostHog — the S-07 frontend surface entry point, off by default content-wise.

**Contract**: Handlers extract only `error_type` + `error_location` (filename/lineno), pass through `scrub`, and call `reportErrorClient`. No message/stack bodies sent. Idempotent attach (guard against double-registration).

#### 3. Layout wiring

**File**: `src/layouts/Layout.astro`

**Intent**: Load the client init once on every page so the scaffold is globally present.

**Contract**: Add a single client-side script/island that imports and runs the init when `PUBLIC_POSTHOG_KEY` is set. Cookieless, no blocking of render. Respect existing CSP/script conventions in the layout.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes (client bundle includes posthog-js only when used): `npm run build`

#### Manual Verification:

- With PostHog configured, the browser loads PostHog in cookieless mode (no PostHog cookies set — verify in devtools Application tab).
- With PostHog unconfigured, no client init runs and no console errors appear.
- The error-hook scaffold is attached (verifiable via a thrown test error in Phase 4) and forwards only type/location.

---

## Phase 4: Proof-of-Life Smoke Emission

### Overview

Add a guarded debug trigger that emits one content-free smoke event and one deliberate test error from both server and client, verifying the full pipeline reaches PostHog EU.

### Changes Required:

#### 1. Server smoke trigger

**File**: `src/pages/api/observability/smoke.ts` (or a guarded branch on an existing debug route)

**Intent**: Prove the server emit path end-to-end against the real PostHog EU project.

**Contract**: A `GET`/`POST` route (`prerender = false`) that, only when a debug flag/secret is present (never enabled in production by default), calls `track("observability_smoke", { surface: "server" })` and `reportError(new Error("smoke-test"), { error_location: "smoke" })`, then returns a small `{ ok: true }` JSON. Guarded so anonymous/production traffic cannot trigger it.

#### 2. Client smoke trigger

**File**: `src/lib/observability/client.browser.ts` (dev-guarded) or a debug page

**Intent**: Prove the client init + error hook reach PostHog.

**Contract**: A dev-guarded function (e.g. `window.__obsSmoke()`) that calls `trackClient("observability_smoke", { surface: "client" })` and throws a caught test error routed through the error hook. Documented, not wired into any user-facing UI.

#### 3. Disable/cleanup documentation

**File**: `context/changes/observability-baseline/plan.md` references + inline code comments / README note

**Intent**: Record how the smoke triggers are guarded and how to remove or keep-disabled them after verification.

**Contract**: Comment each trigger with its guard condition and a "remove or keep disabled after F-01 verification" note; document the toggle in README/CLAUDE env notes.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Tests pass: `npm test`
- Build passes: `npm run build`

#### Manual Verification:

- Triggering the server smoke route produces exactly one `observability_smoke` event and one error in the PostHog EU project.
- Triggering the client smoke produces one client `observability_smoke` event and one captured browser error in PostHog.
- Inspecting the captured payloads in PostHog confirms **no** answer/prompt/draft/CV content and only a pseudonymous/session distinct_id.
- The smoke triggers cannot be fired by anonymous/production traffic.

---

## Testing Strategy

### Unit Tests:

- Scrubber drops every disallowed key (including `answers`, `prompt`, `draft`, `content`, unknown keys), oversize strings, and nested objects; only allowlisted primitives survive.
- Identifier HMAC is deterministic, distinct per user, never equal to the raw user id; missing salt → null (no raw id).
- `track`/`reportError` no-op (no `fetch`) when PostHog is unconfigured; best-effort on failure (rejected `fetch` does not throw).

### Integration Tests:

- Smoke route, when enabled with a real key in a non-prod environment, drives a real PostHog capture (manual/contract-level, validated in PostHog UI).

### Manual Testing Steps:

1. Configure PostHog EU keys locally; load the app — no config banner; cookieless (no PostHog cookies).
2. Hit the guarded server smoke route → confirm one event + one error in PostHog, content-free.
3. Run the client smoke in devtools → confirm one client event + one captured error in PostHog.
4. Inspect both payloads for any leaked content (must be none) and a pseudonymous distinct_id.
5. Unset the key → app loads, banner shows, no client init, emission is a no-op.

## Performance Considerations

Emission is best-effort and time-boxed (`AbortController`) so it never adds latency to a user request; server emit should fire-and-forget where an execution context allows. The client bundle adds `posthog-js` only when configured; init is cookieless and `autocapture: false` to keep it light.

## Migration Notes

No data migration. New Worker secrets (`POSTHOG_API_KEY`, `OBSERVABILITY_ID_SALT`, `POSTHOG_HOST`) and public client vars must be added in each environment; `wrangler rollback` does not restore secrets, so document them in the deploy checklist. The pseudonymous ID is derived from `OBSERVABILITY_ID_SALT` — rotating the salt re-pseudonymizes all users (acceptable for a baseline; note it).

## References

- Roadmap slice: `context/foundation/roadmap.md` (F-01)
- PRD: `context/foundation/prd-v3.md` FR-008 / FR-009 / FR-010, NFR Observability + Privacy
- Stack constraint: `context/foundation/stack-assessment.md` (Workers runtime constraint, lines 157-172)
- Workers-safe `fetch` emit pattern: `src/lib/services/cv-generation.ts`
- Config-banner pattern: `src/lib/config-status.ts`, `src/layouts/Layout.astro:29-45`
- Env pattern: `astro.config.mjs` `env.schema`, `astro:env/server` usage in `src/lib/supabase.ts:4`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Configuration & Provisioning

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Build passes with new env fields: `npm run build`

#### Manual

- [x] 1.4 PostHog EU Cloud project exists and keys stored as Worker secrets
- [x] 1.5 App loads + banner shows when PostHog unconfigured; banner absent when configured

### Phase 2: Server-Side Recording Contract

#### Automated

- [ ] 2.1 Unit tests pass: `npm test`
- [ ] 2.2 Scrub test proves no disallowed key can be emitted: `npm test src/lib/observability/scrub.test.ts`
- [ ] 2.3 Type checking passes: `npm run typecheck`
- [ ] 2.4 Linting passes: `npm run lint`

#### Manual

- [ ] 2.5 Code review confirms allowlist semantics; raw user id / content cannot reach `fetch`
- [ ] 2.6 Emission is best-effort: forced PostHog failure does not throw into or slow a request path

### Phase 3: Client Init Scaffold + Browser Error Hook

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 PostHog loads cookieless (no PostHog cookies in devtools) when configured
- [ ] 3.5 No client init / no console errors when unconfigured
- [ ] 3.6 Error-hook scaffold attached and forwards only type/location

### Phase 4: Proof-of-Life Smoke Emission

#### Automated

- [ ] 4.1 Type checking passes: `npm run typecheck`
- [ ] 4.2 Linting passes: `npm run lint`
- [ ] 4.3 Tests pass: `npm test`
- [ ] 4.4 Build passes: `npm run build`

#### Manual

- [ ] 4.5 Server smoke route produces one `observability_smoke` event + one error in PostHog EU
- [ ] 4.6 Client smoke produces one client event + one captured browser error in PostHog
- [ ] 4.7 Captured payloads contain no answer/prompt/draft/CV content; only pseudonymous/session distinct_id
- [ ] 4.8 Smoke triggers cannot be fired by anonymous/production traffic
