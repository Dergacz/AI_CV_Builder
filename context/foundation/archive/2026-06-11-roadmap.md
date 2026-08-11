---
project: AI CV Builder — Commercial Readiness Release
version: 1
status: draft
created: 2026-06-09
updated: 2026-06-10
prd_version: 2
main_goal: market-feedback
top_blocker: none
---

# Roadmap: AI CV Builder — Commercial Readiness Release (Wave 1)

> Derived from `context/foundation/prd-v2.md` (v2) + auto-researched codebase baseline.
> The completed MVP roadmap is archived at `context/foundation/archive/2026-06-09-roadmap.md`.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

The MVP proves that guided self-description produces a usable CV, but it is free and
not commercially packaged. This release turns it into a sellable product: a small
subscription (~$2–3/month) that automatically upgrades a paying user's CV generation
from a **Basic** tier to an **Advanced** tier, gated server-side so it can't be
bypassed. The **product wedge** — the one trait that, if removed, makes the product
just another free generator — is that paying users get a demonstrably better-written
CV (an edge they can't self-assess) while the full free flow keeps working unchanged.
Wave 1 sells on the Advanced tier alone; ATS features, templates, photo, and theming
are sequenced into later waves.

## North star

**S-02: User can subscribe and immediately receive server-gated Advanced generation** —
the slice that closes the commercial loop end to end (pay → entitlement flips →
generation runs Advanced, unbypassable). Under the `market-feedback` goal this is the
validation milestone: it is the first point at which a real person can pay and the
"invisible edge" hypothesis can be tested with money, not opinion.

> North star here means the smallest end-to-end, user-visible slice whose successful
> delivery would prove the core product hypothesis — placed as early as its
> prerequisites allow, because everything else (landing polish, Google login, cookie
> banner) only matters if people actually pay for Advanced. S-02 sits behind a thin
> enabling chain (F-01 → S-01); those come first only because S-02 cannot exist
> without them.

## At a glance

**Status legend** (mutually exclusive):

- `ready` — all prerequisites met (none, or a present baseline layer); ready to hand to `/10x-plan`.
- `proposed` — prerequisites exist in this roadmap but are not yet implemented.
- `blocked` — one or more Unknowns with `Block: yes` (none in this roadmap).

| ID   | Change ID                          | Outcome (user can …)                                              | Prerequisites    | PRD refs                       | Status   |
| ---- | ---------------------------------- | ---------------------------------------------------------------- | ---------------- | ------------------------------ | -------- |
| F-01 | entitlement-contract-and-store     | (foundation) subscription state is stored additively and read by a single server-authoritative entitlement resolver | —                | FR-003, FR-012                 | done     |
| S-01 | server-gated-advanced-generation   | get Advanced output automatically when entitled, Basic otherwise — enforced server-side | F-01 ✓           | US-01, FR-002, FR-003, FR-004, FR-011 | ready    |
| S-02 | subscription-checkout-and-entitlement | subscribe (~$2–3/mo), manage, and cancel — and have entitlement flip to Advanced | F-01, S-01       | US-01, FR-001                  | proposed |
| S-03 | google-sign-in-account-linking     | sign in with Google, linked to their existing account by verified email | —                | US-02, FR-007, FR-008, FR-009  | ready    |
| S-04 | commercial-landing-page            | understand the value, see pricing/what Advanced unlocks, and start | —                | FR-005, FR-006                 | ready    |
| S-05 | cookie-consent-banner              | see a cookie notice and accept or dismiss it                     | —                | FR-010                         | ready    |
| S-06 | retroactive-advanced-regeneration  | re-generate an existing saved CV with Advanced after subscribing | S-01, S-02       | US-01, FR-002, FR-012          | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                  | Chain                                  | Note                                                                                     |
| ------ | ---------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| A      | Commercial loop        | `F-01` → `S-01` → `S-02` → `S-06`      | The wedge chain; holds the north star (`S-02`). Sequenced first under the `market-feedback` goal. |
| B      | Account access         | `S-03`                                 | Standalone, no prerequisites — Google sign-in extends the existing auth independently.    |
| C      | Storefront & compliance | `S-04` / `S-05`                       | Public-facing surfaces, no prerequisites, parallel with each other. `S-04`'s pay CTA wires to `S-02` when it lands. |

## Baseline

What's already in place in the codebase as of `2026-06-09` (auto-researched + `tech-stack.md`).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6.3 SSR + React 19 islands, Tailwind 4, shadcn/ui (`astro.config.mjs`, `src/components/`).
- **Backend / API:** present — Astro SSR with uppercase route handlers (`src/pages/api/{auth,cv}/**`) and a service layer (`src/lib/services/`).
- **Data:** present — Supabase Postgres with owner-only RLS: `public.cvs` (`supabase/migrations/20260606103740_create_cvs.sql`) and now `public.subscriptions` + `get_entitlement()` resolver (`supabase/migrations/20260609132956_create_subscriptions.sql`), delivered by F-01.
- **Auth:** present, email/password only — Supabase SSR + middleware (`src/lib/supabase.ts`, `src/middleware.ts`). **No Google/OAuth** anywhere — that gap is S-03.
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`), GitHub Actions `ci.yml` + `deploy.yml`. Payment provider is an external SaaS, not built here.
- **Observability:** absent at the application layer — Cloudflare platform observability binding only; no Sentry/OTel/logging lib. **No cookie-banner code** (gap is S-05) and **no payment code** (gap is S-02) exists anywhere.

## Foundations

### F-01: Entitlement contract and store

- **Outcome:** (foundation) subscription state is stored additively in a new owner-only table, and a single server-side entitlement resolver answers "is this user Advanced right now?" — the one source of truth that every gated path reads. No checkout and no provider integration here; storage + read contract only.
- **Change ID:** entitlement-contract-and-store
- **PRD refs:** FR-003 (server-authoritative, unbypassable), FR-012 (additive — must not mutate existing `public.cvs` rows or the `GeneratedCvDraft` shape)
- **Unlocks:** S-01 (reads the resolver to choose the tier), S-02 (writes entitlement on payment success); reduces the FR-003 bypass risk by centralizing the gate.
- **Prerequisites:** —
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Shape of the entitlement record (status + paid-through timestamp) sufficient to express the cancellation rule "Advanced persists until end of paid period." — Owner: team. Block: no.
- **Risk:** Sequenced first because both the gate (S-01) and the checkout (S-02) depend on a stable entitlement read; if its shape were decided ad hoc inside S-02, S-01 would drift into an incompatible read. Kept minimal (storage + resolver, additive, RLS owner-only) so it doesn't become a premature billing layer — S-01/S-02 still integrate it through real user behavior.
- **Delivered (2026-06-10):** `public.subscriptions` (`status` + `current_period_end`, unique `user_id`) with **read-own-only RLS and no user write policy** (self-grant denied, FR-003); `get_entitlement()` DB-clock function; `resolveEntitlement(supabase, userId)` → `{ tier, isAdvanced, activeUntil }` (defaults to Basic with no row); privileged `upsertEntitlement` write helper for S-02 to reuse. Commits `82a6bbc` → `d0e8af3`. The entitlement-record unknown is resolved: cancellation is encoded purely via `current_period_end > now()`.
- **Status:** done

## Slices

### S-01: Server-gated Advanced vs Basic generation

- **Outcome:** a user's CV generation automatically runs the Advanced tier when their entitlement is active and Basic otherwise, enforced on the server for every generation request and unbypassable from the client; the UI reflects the active tier and shows non-subscribers a simple upgrade prompt paired with a concrete benefit.
- **Change ID:** server-gated-advanced-generation
- **PRD refs:** US-01, FR-002 (auto Basic/Advanced), FR-003 (server-authoritative), FR-004 (Basic/Advanced framing + upgrade prompt, no model names), FR-011 (free Basic flow unchanged)
- **Prerequisites:** F-01
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - How to make the Basic→Advanced quality delta genuinely tangible, and which concrete benefit to advertise (e.g. "better wording / ATS-ready"). — Owner: user. Block: no (per `top_blocker: none` — verified and tuned from real output/usage, not pre-launch; this is the release's core product risk to watch, not a planning blocker).
  - The Advanced model preserves the existing strict structured-output + zod contract and `GeneratedCvDraft` shape — only the model swaps. — Owner: team. Block: no.
- **Risk:** This is the riskiest-assumption slice — the wedge mechanism. Verifiable end to end by seeding an entitlement (no real payment needed yet — use the F-01 seed snippet / `upsertEntitlement`), so it can land before S-02. The Advanced timing NFR (~30s bar) is a flag to watch here.
- **Status:** ready (F-01 prerequisite delivered)

### S-02: Subscription checkout and entitlement (north star)

- **Outcome:** a user can subscribe to the paid plan (~$2–3/month) through a PCI-compliant third-party provider, view and cancel it, and on successful payment their entitlement flips to Advanced so their next generation (S-01) runs Advanced; cancelling keeps Advanced until the end of the already-paid period, then drops to Basic. In-progress CV work is preserved through the upgrade.
- **Change ID:** subscription-checkout-and-entitlement
- **PRD refs:** US-01, FR-001 (subscribe / manage / cancel)
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Which third-party payment provider, integrated `fetch`-only within the Cloudflare Workers runtime (no Node-only SDK), writing entitlement on a verified payment signal. — Owner: user. Block: no (provider selectable at plan time; `top_blocker: none`).
  - The app stores only a subscription reference/status and never raw card data; the privacy-logging rule extends to the payment/webhook path. — Owner: team. Block: no.
- **Risk:** Closes the commercial loop — depends on S-01 so that a flipped entitlement is actually user-visible as Advanced output. The Workers-runtime constraint (`fetch`-based, no Node SDK) is the main integration risk; pick a provider whose API/webhooks work edge-side.
- **Status:** proposed

### S-03: Google sign-in with account linking

- **Outcome:** a user can sign up and sign in with Google alongside the existing email/password option, and a Google sign-in whose verified email matches an existing account resolves to that same account (no duplicate) with all their saved CVs available; existing email/password accounts and sessions keep working unchanged.
- **Change ID:** google-sign-in-account-linking
- **PRD refs:** US-02, FR-007 (Google sign-in), FR-008 (link by verified email), FR-009 (preserve email/password)
- **Prerequisites:** —
- **Parallel with:** F-01, S-01, S-02, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Account-linking only occurs when email is verified on both sides, to avoid takeover via unverified email. — Owner: team. Block: no.
- **Risk:** The most autonomous slice — extends the existing Supabase auth, no dependency on the commercial core. Main risk is the linking edge case (matching vs duplicate accounts); preservation of existing logins (FR-009) is a hard guardrail.
- **Status:** ready

### S-04: Commercial landing page

- **Outcome:** a visitor sees an improved landing page that conveys the value proposition, trust signals (why to trust the app with their data and career), and pricing / what the Advanced tier unlocks, and can start; subtle, non-distracting animations are included as a nice-to-have.
- **Change ID:** commercial-landing-page
- **PRD refs:** FR-005 (value + trust + pricing), FR-006 (subtle animations, nice-to-have)
- **Prerequisites:** —
- **Parallel with:** F-01, S-01, S-02, S-03, S-05
- **Blockers:** —
- **Unknowns:**
  - Willingness to pay at the ~$2–3 point — validate before over-investing in landing polish. — Owner: user. Block: no (informs scope, not buildability).
  - Animations carry an explicit performance guardrail: they must not regress mobile or cold-load performance; cut if they do. — Owner: team. Block: no.
- **Risk:** Buildable in parallel; the only coupling is that the pay CTA wires to S-02's checkout once it lands (until then it points into the existing flow). Keep it lean — enough to pitch and price, not a full marketing site.
- **Status:** ready

### S-05: Cookie consent banner

- **Outcome:** a visitor sees a cookie notice/banner and can accept or dismiss it; the notice reflects a real audit of which cookies the app actually sets (essential vs non-essential), not a decorative widget.
- **Change ID:** cookie-consent-banner
- **PRD refs:** FR-010
- **Prerequisites:** —
- **Parallel with:** F-01, S-01, S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Enumerate the cookies the app actually sets (essential vs non-essential) to drive the banner's scope and any legal consent need. — Owner: user. Block: no (a quick audit that should precede shipping the banner, but doesn't block planning).
- **Risk:** Smallest compliance slice, fully autonomous. The risk is shipping consent theater — the audit must be real before the banner ships.
- **Status:** ready

### S-06: Retroactive Advanced regeneration

- **Outcome:** after subscribing, a user can re-generate an existing saved CV with the Advanced tier (not only new generations), making the upgrade's value immediate and tangible; existing saved CVs remain valid and the export quality does not regress.
- **Change ID:** retroactive-advanced-regeneration
- **PRD refs:** US-01, FR-002 (Advanced applies), FR-012 (existing CVs valid, no export regression)
- **Prerequisites:** S-01, S-02, seeded entitlement on a saved CV (existing saved-CV flow — present in baseline)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Re-generation must not corrupt the stored draft if it fails midway; existing draft stays valid on failure. — Owner: team. Block: no.
- **Risk:** Directly mitigates the FR-002 imperceptible-delta risk by letting subscribers feel the upgrade on CVs they already wrote. Last in the chain because it needs both the gate (S-01) and a real subscription (S-02).
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                              | Suggested issue title                                              | Ready for `/10x-plan` | Notes |
| ---------- | -------------------------------------- | ----------------------------------------------------------------- | --------------------- | ----- |
| F-01       | entitlement-contract-and-store         | Add entitlement store + server-authoritative resolver             | done ✓                | Implemented 2026-06-10 (`82a6bbc`→`d0e8af3`); not yet archived. Unblocks S-01 and S-02. |
| S-01       | server-gated-advanced-generation       | Gate generation tier (Basic/Advanced) server-side                 | yes                   | F-01 delivered. The wedge mechanism; verifiable with a seeded entitlement via `upsertEntitlement`. |
| S-02       | subscription-checkout-and-entitlement  | Subscribe / manage / cancel via third-party provider              | no                    | Needs F-01 + S-01. North star; pick a Workers-`fetch`-safe provider. |
| S-03       | google-sign-in-account-linking         | Add Google sign-in with verified-email account linking            | yes                   | No prerequisites — can run in parallel with the commercial core. |
| S-04       | commercial-landing-page                | Rebuild landing with value, trust, and pricing                    | yes                   | No prerequisites; pay CTA wires to S-02 later. |
| S-05       | cookie-consent-banner                  | Add cookie consent banner backed by a real cookie audit           | yes                   | No prerequisites; run the cookie audit first. |
| S-06       | retroactive-advanced-regeneration      | Let subscribers re-generate existing CVs with Advanced            | no                    | Needs S-01 + S-02. Makes the upgrade tangible. |

## Open Roadmap Questions

1. **Basic→Advanced quality delta** — Owner: user. Gates: S-01 (non-blocking). The release's core product risk: how to create and verify a genuinely tangible quality difference, and which concrete benefit to advertise as "Advanced." Per `main_goal: market-feedback`, validated from real output rather than pre-launch.
2. **Payment provider selection** — Owner: user. Gates: S-02 (non-blocking). Choose a PCI-compliant provider whose API/webhooks operate `fetch`-only inside Cloudflare Workers (no Node SDK).
3. **Cookie/privacy audit** — Owner: user. Gates: S-05 (non-blocking). Enumerate the cookies the app sets (essential vs non-essential) before the banner ships.
4. **Conversion strength** — Owner: user. Roadmap-wide (non-blocking). Is an unlimited free tier + a perceptible Advanced benefit enough to convert, or are soft levers needed? Resolve post-launch from conversion data.
5. **Pricing validation** — Owner: user. Informs S-04 (non-blocking). Confirm willingness to pay at ~$2–3 before over-investing in landing polish.

## Parked

- **Hidden ATS skills & advanced ATS features** — Why parked: PRD Non-Goals defer ATS to Wave 2; Wave 1 sells on the Advanced tier alone.
- **Candidate location & clickable contacts** — Why parked: Wave 2 (`## Forward: roadmap waves`).
- **Resume page-count control (1/2/Auto) with AI compression** — Why parked: Wave 2.
- **Multiple resume templates** — Why parked: Wave 3.
- **Optional photo support (template-dependent)** — Why parked: Wave 3.
- **Dark theme** — Why parked: Wave 3.
- **Pay-per-use / one-time purchases** — Why parked: PRD Non-Goals; subscription is the single paid path.
- **Custom billing infrastructure** — Why parked: PRD Non-Goals; billing is handled by a third-party provider.
- **Team / shared / org accounts & multiple paid tiers** — Why parked: PRD Non-Goals; single-user accounts, one paid tier.

## Done

> `/10x-archive` normally appends here when a change is archived. F-01 is implemented and
> impl-reviewed but **not yet archived** — recorded below ahead of archival.

- **F-01: entitlement-contract-and-store** — implemented 2026-06-10. Owner-only `public.subscriptions` store (read-own-only RLS, no user write policy), `get_entitlement()` DB-clock function, `resolveEntitlement` resolver, and privileged `upsertEntitlement` write helper. Commits `82a6bbc` (schema) → `67721cc` (resolver+types) → `5438a50` (tests) → `d0e8af3` (epilogue). Unblocks S-01 and S-02.
