---
project: AI CV Builder — Commercial Readiness Release
version: 2
status: draft
created: 2026-06-09
context_type: brownfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: null
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

AI CV Builder turns guided self-description into a structured, professional CV for
people who get stuck at the blank page.

- **Architecture:** server-side-rendered web application on a serverless platform
  (Cloudflare Workers), with interactive React islands for the questionnaire and
  editor.
- **Tech stack:** Astro 6 SSR, React 19, Tailwind 4, shadcn/ui ("new-york"); Supabase
  for authentication and Postgres data; OpenAI Chat Completions (hardcoded
  `gpt-4o-mini`, strict structured outputs) for generation; `@react-pdf/renderer` for
  PDF export.
- **User base:** medium scale (dozens to ~100), individuals creating their own CVs.
- **Core functionality today:** email/password authentication (cookie-based sessions,
  middleware-protected routes); an AI-guided questionnaire → full CV generation
  (~25s, privacy-preserving — raw answers, prompt, and draft are never logged) → one
  clean professional template → simple section-based editing (Summary, Experience,
  Education, Skills, Languages) → save → PDF export → a dashboard library of saved
  CVs. CV output is available in English, Polish, and Russian. Persistence is a single
  `public.cvs` table (JSONB draft + JSONB source snapshot) with owner-only row-level
  security.
- **Absent today (the change surface):** subscription/billing, AI model choice,
  multiple templates, Google login, dark mode, cookie banner, photo support, ATS
  features, candidate location & clickable contacts, resume page-count control.

## Problem Statement & Motivation

The MVP proves that guided self-description produces a usable CV, but it is free,
single-template, and not commercially packaged — there is no way for the product to
earn revenue, and no premium value to convert motivated users.

To become commercially viable, the product needs a subscription and a tangible paid
benefit. The trigger is the decision to monetize: the target audience — active job
seekers under pressure — will pay a small amount (~$2–3/month) for an edge that is
otherwise invisible to them, namely a better-written CV that passes automated
screeners. Today every user receives the same single generation quality for free;
motivated users who would pay for better output or screener-optimization have no way
to do so, and the product captures none of that willingness-to-pay.

Insight: beginners under job-search pressure will pay a small amount for an
otherwise-invisible edge; the product surfaces this as a simple "Basic vs Advanced"
choice rather than exposing model names or ATS jargon.

## User & Persona

**Existing (free) persona — unchanged:** individuals across many organizations — job
seekers, students, career changers, first-time workers — who are not confident
starting from a blank page.

**Primary paying persona (new emphasis):** active job seekers under pressure — people
actively applying who feel urgency and will pay for an edge (better output, screener
pass-through) to land interviews faster.

**Whose experience changes:** existing free users gain an upgrade path and encounter
new surfaces (a stronger landing page with pricing, a cookie notice, a "Sign in with
Google" option); subscribers additionally receive Advanced generation.

## Success Criteria

### Primary

- The commercial loop closes end-to-end: a visitor lands on the improved landing page
  (clear value proposition, pricing, trust signals), creates an account via
  email/password **or Google sign-in**, subscribes for ~$2–3/month, and from then on
  their CV generation automatically uses the **Advanced** tier — gated by subscription
  state in a way the user cannot bypass. A cookie notice is present. The full free
  flow (questionnaire → Basic generation → edit → export → save) continues to work
  unchanged for non-subscribers.

### Secondary

- Upgrading from free to Advanced is smooth and in-context: a user can subscribe
  without losing the CV work they have in progress, and immediately sees their next
  generation run as Advanced.

### Guardrails (must not regress)

- The free generation flow keeps working for non-subscribed users.
- Existing saved CVs and account data remain valid and openable.
- Current PDF export quality does not regress.
- Existing email/password accounts and sessions keep working when Google sign-in
  lands.
- Simplicity holds: the paid choice is presented as "Basic" vs "Advanced," never as
  model names or ATS jargon; the app must not start feeling complex.

## User Stories

### US-01: Free user upgrades to Advanced

- **Given** a job seeker who has used the free flow and wants a better-quality CV
- **When** they subscribe (~$2–3/month) from the landing page or an in-app upgrade
  prompt
- **Then** their subscription is recorded as the authoritative entitlement, their next
  CV generation automatically runs on the Advanced tier, the UI reflects the active
  "Advanced" tier, and any in-progress CV work is preserved through the upgrade.
- *Before this change:* all users received the same single free generation quality;
  there was no paid tier and no upgrade path.

### US-02: Returning user signs in with Google

- **Given** an existing user whose account email matches their Google account
- **When** they choose "Sign in with Google"
- **Then** they are signed into their existing account (not a duplicate), and all
  their previously saved CVs are available.
- *Before this change:* only email/password sign-in existed.

## Scope of Change

Scope covers **Wave 1 — the commercial core**, the smallest sellable slice. Wave 2–3
capabilities are listed in `## Non-Goals` and the roadmap hand-off, not here. Each
item carries its originating FR id and (where captured) the Socratic counter-argument
and resolution.

### Subscription & generation tier

- **[new] FR-001** — User can subscribe to a paid plan (~$2–3/month) and view, manage,
  and cancel that subscription.
  > Socrates: Counter-argument considered: "an unlimited free tier may be too
  > generous for anyone to convert." Resolution: kept; the conversion lever is making
  > Advanced's value perceptible (FR-002/FR-004), not crippling the free tier.
  > Conversion strength is flagged in Open Questions for post-launch tuning.
- **[modified] FR-002** — was: every generation used a single fixed quality for all
  users; now: a subscriber's CV generation automatically uses the Advanced tier and a
  non-subscriber's uses the Basic tier.
  > Socrates: Counter-argument considered: "the quality gap between Basic and
  > Advanced may be imperceptible, collapsing the wedge." Resolution: kept, but this
  > is the core product risk — Advanced must produce demonstrably better output and
  > the difference must be made tangible to the user. Logged in Open Questions: how
  > to create and verify the Basic→Advanced quality delta.
- **[new] FR-003** — The system authoritatively enforces the generation tier on every
  generation request and cannot be bypassed by the user; no client-supplied tier is
  trusted.
  > Socrates: Counter-argument considered: "per-generation server checks add overhead
  > for low-stakes abuse." Resolution: stands; a paid gate that can be bypassed
  > client-side is not a paid gate. Security-critical, kept as written.
- **[new] FR-004** — The tier is presented to users simply as "Basic" vs "Advanced" —
  no model names or technical jargon — with an upgrade prompt shown to non-subscribers,
  paired with a concrete benefit.
  > Socrates: Counter-argument considered: "'Advanced' is vague marketing; a concrete
  > benefit converts better." Resolution: kept the simple Basic/Advanced framing for
  > beginners, but pair "Advanced" with a concrete benefit line (e.g. "better
  > wording / ATS-ready") so the label is not abstract.

### Landing page

- **[modified] FR-005** — was: a minimal MVP landing page; now: an improved landing
  page that conveys the value proposition, trust signals (why to trust the app with
  their data and career), and pricing / what the Advanced tier unlocks.
  > Socrates: Counter-argument considered: "heavy landing investment is premature
  > before willingness-to-pay is proven." Resolution: kept (you cannot sell a
  > subscription off the current landing), but keep it lean — enough to pitch and
  > price, not a full marketing site — and validate pricing willingness early.
- **[new] FR-006** — The landing page uses subtle, non-distracting animations.
  Priority: nice-to-have.
  > Socrates: Counter-argument considered: "even subtle animations can hurt
  > performance on mobile / cold loads." Resolution: kept as nice-to-have with an
  > explicit performance guardrail — animations must not regress mobile or cold-load
  > performance; cut them if they do.

### Authentication

- **[new] FR-007** — User can sign up and sign in with Google, alongside the existing
  email/password option.
  > Socrates: Counter-argument considered: "another auth provider is maintenance +
  > dependency cost for marginal gain." Resolution: stands; reduces signup friction
  > for the paying persona (active job seekers), and the existing auth system already
  > supports the provider so the marginal cost is low.
- **[new] FR-008** — A Google sign-in whose email matches an existing account resolves
  to that same account (account linking by verified email).
  > Socrates: Counter-argument considered: "auto-linking by email risks account
  > takeover if email ownership is unverified." Resolution: stands, with the
  > constraint that linking only occurs on verified emails on both sides; captured as
  > a security constraint in Constraints & Compatibility.
- **[preserved] FR-009** — Existing email/password accounts and sessions continue to
  work unchanged after Google login is added.
  > Socrates: Counter-argument considered: "two auth paths double maintenance."
  > Resolution: stands; breaking existing logins is unacceptable — preservation is a
  > hard guardrail regardless of maintenance cost.

### Compliance

- **[new] FR-010** — Visitor sees a cookie notice/banner and can accept or dismiss it.
  > Socrates: Counter-argument considered: "a banner without a real review is consent
  > theater." Resolution: kept, but the banner must follow an actual audit of which
  > cookies the app actually sets (essential vs non-essential) — the notice must
  > reflect a real privacy review, not be decorative. Logged in Open Questions.

### Preserved core flow

- **[preserved] FR-011** — A non-subscribed user can complete the full existing flow
  (questionnaire → Basic generation → section editing → save → PDF export) unchanged.
  > Socrates: Counter-argument considered: "an unlimited free flow cannibalizes
  > conversion." Resolution: kept unlimited Basic for now — it is the validated MVP
  > and the top-of-funnel — but this is the central conversion tension with FR-001;
  > revisit soft levers if conversion proves weak. Logged in Open Questions.
- **[preserved] FR-012** — Existing saved CVs remain valid and openable, and current
  PDF export quality does not regress.
  > Socrates: Counter-argument considered: "new-feature schema/draft changes could
  > break existing CVs without a migration plan." Resolution: kept as a hard
  > guardrail with an added requirement — any schema or draft-shape change must ship
  > with an explicit migration / backward-compatibility plan. See Constraints &
  > Compatibility.

## Constraints & Compatibility

- **Backward compatibility:** existing accounts, sessions, saved CVs, and the current
  PDF export must continue working unchanged. The generated CV draft structure stays
  stable so existing CVs remain valid and openable.
- **Data migration:** subscription state must be stored additively, without altering
  existing saved-CV records or their data shape. Any change to the stored-CV structure
  must ship with a migration and rollback plan so no existing CV is lost or corrupted.
- **Existing integrations that must continue working:** the current AI generation
  contract (strict structured-output generation producing the CV draft, plus its
  validation), the existing authentication system (Supabase), and the existing PDF
  export (`@react-pdf/renderer`). The Advanced tier changes only which model performs
  generation — not the produced CV structure or the generation contract.
- **Runtime constraint:** new server-side capabilities (payment handling, entitlement
  checks, Advanced generation) must operate within the existing serverless runtime
  (Cloudflare Workers) — `fetch`-based, no Node-only SDKs — consistent with the
  existing generation code.
- **New data stores:** any new tables enable owner-only, per-operation row-level
  security, matching the existing `public.cvs` convention.
- **Auth compatibility:** Google sign-in is added alongside email/password; account
  linking occurs only on verified emails on both sides; existing logins are preserved.
- **Payment-data constraint:** card data is handled exclusively by a PCI-compliant
  third-party payment provider; the product stores only a subscription
  reference/status and never stores raw card data.
- **Privacy preservation:** the existing guarantee — no raw answers, prompt, or draft
  content in operator-accessible logs — extends to all new code paths (payment,
  entitlement, regeneration).

## Business Logic Changes

**Existing rule (preserved):** the application transforms simple, non-professional
user answers into a structured, professional CV — deciding which information is
relevant, how it is phrased, and how it is organized into standard resume sections.

**New rule (this release) — subscription-gated generation tier:** the application
decides which generation quality a user receives based on their subscription state.

- Input: the user's subscription status, which is the authoritative source of truth,
  re-checked on every generation request and not bypassable by the user.
- Output: the generation tier — **Basic** for non-subscribers, **Advanced** for
  subscribers — applied automatically, with no model names exposed to the user.
- Encounter: subscribers' generations simply run on Advanced; non-subscribers run on
  Basic and see a simple upgrade prompt framed around a concrete benefit (e.g. "better
  wording / ATS-ready"), never jargon.
- Cancellation rule: on cancel, Advanced access persists until the end of the
  already-paid period, then the user drops to Basic.
- Retroactivity rule: a subscriber may re-generate their existing saved CVs with
  Advanced, not only new generations — this makes the upgrade's value immediate and
  tangible (mitigates the FR-002 imperceptible-delta risk).

## Access Control Changes

- **Auth:** adds "Sign in with Google" alongside the existing email/password option;
  accounts are linked by verified email so a matching Google sign-in resolves to the
  existing account rather than creating a duplicate.
- **Ownership (preserved):** the existing flat ownership model is unchanged — each
  signed-in user can manage only their own CVs.
- **New entitlement dimension:** a billing entitlement (free vs Advanced), not an RBAC
  role. The entitlement is authoritatively enforced by the product and cannot be
  bypassed from the user's device; it gates Advanced generation (and future advanced
  ATS features). The free tier keeps the full existing flow with unlimited Basic
  generation — feature-gated, not quota-gated.
- **Preserved:** existing email/password accounts and sessions continue to work
  unchanged.

## Non-Goals

- **No ATS features in Wave 1:** hidden ATS skills and advanced ATS features are
  deferred to Wave 2, even though ATS is half the long-term wedge. Wave 1 sells on the
  Advanced tier alone.
- **Subscription only — no pay-per-use:** no one-time purchases or per-generation
  buys; the single paid path is the monthly subscription.
- **No custom billing infrastructure:** billing/payment is handled by a third-party
  provider, not built from scratch.
- **No team / shared / org accounts and no multiple paid tiers:** single-user accounts
  only; one paid tier ("Advanced").

Note: multiple templates, photo support, dark theme, candidate location & clickable
contacts, and page-count control (with AI summarization/compression to fit) are
**sequenced into Wave 2–3**, not hard-excluded — if Wave 1 lands early, one may be
pulled forward. This is roadmap sequencing, not a permanent scope lock. (Subtle
landing animations, FR-006, stay with the Wave 1 landing work as a nice-to-have.)

## Open Questions

1. **Conversion strength (FR-001/FR-011)** — Owner: user; resolve post-launch from
   real conversion data. Is an unlimited free tier plus a perceptible Advanced benefit
   enough to convert, or are soft conversion levers needed? Not blocking.
2. **Basic→Advanced quality delta (FR-002/FR-004)** — Owner: user. The core product
   risk of the release: how to create and verify a genuinely tangible quality
   difference, and which concrete benefit to advertise as "Advanced." Block: this
   determines whether the wedge holds.
3. **Cookie/privacy audit (FR-010)** — Owner: user. Enumerate the cookies the app
   actually sets (essential vs non-essential) to drive the banner's scope and any
   legal consent need. Should precede shipping the banner.
4. **Pricing validation (FR-005)** — Owner: user. Confirm willingness to pay at the
   ~$2–3 point before over-investing in landing-page polish. Not blocking, but
   informs landing scope.
5. **Wave 1 delivery estimate (`timeline_budget.delivery_weeks`)** — TBD by user. The
   release is wave-sequenced with no fixed week estimate or hard deadline (after-hours,
   ship-as-ready), so `delivery_weeks` is `null`. Not blocking.
