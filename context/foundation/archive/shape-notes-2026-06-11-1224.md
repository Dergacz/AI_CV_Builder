---
project: AI CV Builder — Commercial Readiness Release
context_type: brownfield
created: 2026-06-09
updated: 2026-06-09
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: context type
      decision: brownfield
    - topic: commercial wedge
      decision: Better AI quality (Advanced model) + ATS optimization
    - topic: primary paying persona
      decision: Active job seekers under pressure
    - topic: must-preserve / blast radius
      decision: Free generation flow, existing saved CVs & data, current PDF export quality, existing auth sessions
  frs_drafted: 12
  quality_check_status: accepted
timeline_budget:
  delivery_weeks: null
  hard_deadline: null
  after_hours_only: true
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
---

# Shape Notes — Commercial Readiness Release (Brownfield)

Seed idea: Evolve the existing AI CV Builder MVP into a more complete, commercially
ready resume builder with a subscription model — while keeping it minimalistic and
beginner-friendly. Ten shaping areas: stronger landing page, subscription model
(Basic/Advanced generation), hidden ATS skills, Google login, resume page-count
control, photo support, multiple templates, location & clickable contacts, dark
theme, cookie banner. To be sequenced into launch-critical waves.

## Current System

The product is a shipped Astro 6 SSR web app (React 19 islands, Tailwind 4,
shadcn/ui "new-york"), deployed to Cloudflare Workers, with Supabase auth.

- **Auth:** Supabase email/password only (`signin` / `signup` / `confirm-email`),
  cookie-based SSR sessions, middleware-enforced route protection.
- **AI generation:** OpenAI Chat Completions, hardcoded `gpt-4o-mini`, strict
  structured outputs, ~25s timeout, called via `fetch` (Cloudflare Workers runtime).
  Privacy contract: never logs raw answers, prompt, or draft content.
- **Data:** single `public.cvs` table — JSONB `draft` (GeneratedCvDraft) + JSONB
  `source_snapshot` (questionnaire answers + version), RLS owner-only on every
  operation, CV output languages constrained to `en` / `pl` / `ru`.
- **Core flow:** landing → AI-guided questionnaire → full CV generation → one clean
  professional template → simple section-based editing (Summary, Experience,
  Education, Skills, Languages) → save → PDF export (`@react-pdf/renderer`) →
  dashboard library of saved CVs.
- **i18n:** CV output in en/pl/ru; UI locale switcher.

**Absent today (the change surface):** subscriptions/billing, AI model choice,
multiple templates, Google OAuth, dark mode, cookie banner, photo support, ATS
features, candidate location & clickable contacts, resume page-count control.

## Vision & Problem Statement

The MVP proves that guided self-description can produce a usable CV, but it is free,
single-template, and not yet commercially packaged. This release evolves it into a
sellable product without losing its beginner-friendly simplicity.

**The delta — what's changing and why:** introduce a small subscription (~$2–3/mo)
that unlocks an "Advanced" tier, where the wedge is a **better-written CV that
actually passes ATS screeners**. Free users keep the full existing flow; paying
users get a stronger generation model and ATS optimization (including hidden,
parser-visible skills). Around this commercial core sits a layer of polish that
makes the product feel complete and trustworthy: a stronger landing page, multiple
templates, photo support, length control, clickable contacts, dark mode, and a
cookie banner.

**Insight:** beginners under job-search pressure will pay a small amount for an
edge that is otherwise invisible to them — a better model and ATS optimization they
cannot self-assess. The product surfaces this as a simple "Basic vs Advanced" choice
rather than exposing model names or ATS jargon.

## User & Persona

Primary (free) persona unchanged: individuals across many orgs — job seekers,
students, career changers, first-time workers — who are not confident starting from
a blank page.

Primary **paying** persona: **active job seekers under pressure** — people actively
applying who feel urgency and will pay for an edge (better output, ATS pass-through)
to land interviews faster.

## Access Control

**Current model (preserved):** Supabase email/password auth, cookie-based SSR
sessions, flat user model — every signed-in user manages only their own CVs (RLS
owner-only). This stays intact; existing accounts and sessions must not break.

**Auth change — add Google login:** Google OAuth becomes a second sign-in option
alongside email/password. Accounts are **linked by email**: a Google sign-in whose
email matches an existing account resolves to the same user, avoiding duplicate
accounts.

**New entitlement dimension — free vs Advanced (subscription):** introduces a
billing entitlement, not an RBAC role. Subscription status is the **server-side
source of truth**; every gated action (Advanced-model generation, advanced ATS
features) re-checks entitlement on the server. Client UI only reflects state and can
never be the gate.

**Free vs paid boundary:** the free tier keeps the **full existing flow with
unlimited Basic generation**, editing, and export — no hard usage caps. The paid
"Advanced" tier unlocks the better generation model and advanced ATS features (and,
pending Phase 5/6, may also gate premium templates/photo). Feature-gated, not
quota-gated.

## Success Criteria

Scoped to **Wave 1 — the commercial core** (smallest sellable slice). Later waves
are captured under `## Forward: roadmap waves`; they are explicitly out of this
release's primary success bar.

### Primary

- A visitor lands on the improved landing page (clear value prop, pricing, trust
  signals), creates an account via email/password **or Google login**, subscribes
  for ~$2–3/month, and from then on their CV generation automatically uses the
  **Advanced** model — gated server-side by subscription state. A cookie banner is
  present. The full free flow (questionnaire → Basic generation → edit → export →
  save) continues to work unchanged for non-subscribers. The commercial loop closes:
  a real user can pay and receive the Advanced benefit.

### Secondary

- Upgrading from free to Advanced is smooth and in-context: a user can subscribe
  without losing the CV/work they have in progress, and immediately sees their next
  generation run as Advanced.

### Guardrails (must not break)

- Free generation flow keeps working for non-subscribed users.
- Existing saved CVs and account data remain valid and openable.
- Current PDF export quality does not regress.
- Existing email/password accounts and sessions keep working when Google login lands.
- Simplicity holds: the paid choice is presented as "Basic" vs "Advanced," never as
  model names or ATS jargon; the app must not start feeling complex.

## Timeline acknowledgment

Acknowledged on 2026-06-09: the full 10-area scope is far larger than a few weeks of
after-hours work. Cost surfaced (brownfield half-done risk). User accepted the
sustained-effort reality and **scoped the release into waves**, with Wave 1 as the
scoped-down first sellable slice. No hard deadline; after-hours; ship waves as ready.

## Functional Requirements

Scope: **Wave 1 — commercial core.** Wave 2–3 capabilities live in
`## Forward: roadmap waves` and become FRs when their wave is planned.

### Subscription & generation tier

- FR-001: User can subscribe to a paid plan (~$2–3/month) and view, manage, and
  cancel that subscription. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "an unlimited free tier may be too
  > generous for anyone to convert." Resolution: kept; the conversion lever is making
  > Advanced's value perceptible (FR-002/FR-004), not crippling the free tier.
  > Conversion strength is flagged in Open Questions for post-launch tuning.
- FR-002: A subscribed user's CV generation automatically uses the Advanced model; a
  non-subscribed user's generation uses the Basic model. Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "the quality gap between Basic and
  > Advanced may be imperceptible, collapsing the wedge." Resolution: kept, but this
  > is the core product risk — Advanced must produce demonstrably better output and
  > the difference must be made tangible to the user. Logged in Open Questions: how
  > to create and verify the Basic→Advanced quality delta.
- FR-003: The system enforces the generation tier server-side on every generation
  request, never trusting a client-supplied tier. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "per-generation server checks add overhead
  > for low-stakes abuse." Resolution: stands; a paid gate that can be bypassed
  > client-side is not a paid gate. Security-critical, kept as written.
- FR-004: The tier is presented to users simply as "Basic" vs "Advanced" — no model
  names or technical jargon — with an upgrade prompt shown to non-subscribers.
  Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "'Advanced' is vague marketing; a concrete
  > benefit converts better." Resolution: kept the simple Basic/Advanced framing for
  > beginners, but pair "Advanced" with a concrete benefit line (e.g. "better
  > wording / ATS-ready") so the label is not abstract.

### Landing page

- FR-005: Visitor sees an improved landing page that conveys the value proposition,
  trust signals (why to trust the app with their data and career), and pricing /
  what the Advanced tier unlocks. Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "heavy landing investment is premature
  > before willingness-to-pay is proven." Resolution: kept (you cannot sell a
  > subscription off the current landing), but keep it lean — enough to pitch and
  > price, not a full marketing site — and validate pricing willingness early.
- FR-006: The landing page uses subtle, non-distracting animations. Priority:
  nice-to-have. Change: new
  > Socrates: Counter-argument considered: "even subtle animations can hurt
  > performance on mobile / Cloudflare cold loads." Resolution: kept as nice-to-have
  > with an explicit performance guardrail — animations must not regress mobile or
  > cold-load performance; cut them if they do.

### Authentication

- FR-007: User can sign up and sign in with Google, alongside the existing
  email/password option. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "another auth provider is maintenance +
  > dependency cost for marginal gain." Resolution: stands; reduces signup friction
  > for the paying persona (active job seekers), and Supabase already supports the
  > provider so the marginal cost is low.
- FR-008: A Google sign-in whose email matches an existing account resolves to that
  same account (account linking by email). Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "auto-linking by email risks account
  > takeover if email ownership is unverified." Resolution: stands, with the
  > constraint that linking only occurs on verified emails on both sides; captured as
  > a security constraint in Phase 5.
- FR-009: Existing email/password accounts and sessions continue to work unchanged
  after Google login is added. Priority: must-have. Change: preserved
  > Socrates: Counter-argument considered: "two auth paths double maintenance."
  > Resolution: stands; breaking existing logins is unacceptable — preservation is a
  > hard guardrail regardless of maintenance cost.

### Compliance

- FR-010: Visitor sees a cookie notice/banner and can accept or dismiss it.
  Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "a banner without a real review is consent
  > theater." Resolution: kept, but the banner must follow an actual audit of which
  > cookies the app actually sets (essential vs non-essential) — the UI widget must
  > reflect a real privacy review, not be decorative. Logged in Open Questions.

### Preserved core flow

- FR-011: A non-subscribed user can complete the full existing flow (questionnaire →
  Basic generation → section editing → save → PDF export) unchanged. Priority:
  must-have. Change: preserved
  > Socrates: Counter-argument considered: "an unlimited free flow cannibalizes
  > conversion." Resolution: kept unlimited Basic for now — it is the validated MVP
  > and the top-of-funnel — but this is the central conversion tension with FR-001;
  > revisit soft levers if conversion proves weak. Logged in Open Questions.
- FR-012: Existing saved CVs remain valid and openable, and current PDF export
  quality does not regress. Priority: must-have. Change: preserved
  > Socrates: Counter-argument considered: "new-feature schema/draft changes could
  > break existing CVs without a migration plan." Resolution: kept as a hard
  > guardrail with an added requirement — any schema or draft-shape change must ship
  > with an explicit migration / backward-compatibility plan. Captured in Constraints
  > & Preserved Behavior (Phase 5).

## User Stories

### US-01: Free user upgrades to Advanced

- **Given** a job seeker who has used the free flow and wants a better-quality CV
- **When** they subscribe (~$2–3/month) from the landing page or an in-app upgrade prompt
- **Then** their subscription is recorded server-side, their next CV generation
  automatically runs on the Advanced model, the UI reflects the active "Advanced"
  tier, and any in-progress CV work is preserved through the upgrade.

### US-02: Returning user signs in with Google

- **Given** an existing user whose account email matches their Google account
- **When** they choose "Sign in with Google"
- **Then** they are signed into their existing account (not a duplicate), and all
  their previously saved CVs are available.

## Business Logic

**Existing rule (preserved):** the application transforms simple, non-professional
user answers into a structured, professional CV — deciding which information is
relevant, how it is phrased, and how it is organized into standard resume sections.

**New rule (this release) — subscription-gated generation tier:** the application
decides which generation quality a user receives based on their subscription state.

- Input: the user's subscription status, which is the **server-authoritative** source
  of truth (re-checked on every generation request).
- Output: the generation tier — **Basic** for non-subscribers, **Advanced** for
  subscribers — applied automatically, with no model names exposed to the user.
- The user encounters it implicitly: subscribers' generations simply run on Advanced;
  non-subscribers run on Basic and see a simple upgrade prompt framed around a
  concrete benefit (e.g. "better wording / ATS-ready"), never model jargon.
- Cancellation rule: on cancel, Advanced access persists until the **end of the
  already-paid period**, then the user drops to Basic.
- Retroactivity rule: a subscriber may re-generate their **existing saved CVs** with
  Advanced, not only new generations — this makes the upgrade's value immediate and
  tangible (mitigates the FR-002 imperceptible-delta risk).

## Constraints & Preserved Behavior

- **Runtime constraint (Cloudflare Workers):** all new server code — payment/webhook
  handling, entitlement checks, Advanced generation — must use `fetch`-compatible,
  Workers-safe approaches with no Node-only SDKs, consistent with the existing
  `cv-generation.ts` pattern.
- **Additive data model:** subscription state is stored additively (new table/columns
  keyed to the user); it must never mutate existing `public.cvs` rows or the
  `GeneratedCvDraft` shape. Any schema or draft-shape change ships with an explicit
  migration / backward-compatibility plan (FR-012).
- **RLS convention:** any new tables enable row-level security with owner-only,
  per-operation policies, matching the existing `public.cvs` convention.
- **Auth constraints:** Google is added as a Supabase OAuth provider; account linking
  occurs only on verified emails on both sides (FR-008); existing email/password
  accounts and sessions are preserved unchanged (FR-009).
- **Generation contract:** the Advanced tier swaps the model only — it preserves the
  existing OpenAI strict-structured-output + zod-validation contract and the
  `GeneratedCvDraft` output schema, so existing draft shape stays stable.
- **Export isolation:** the current single-template PDF export path stays intact;
  future template/photo work (Wave 3) must be isolated so it cannot regress the
  existing template's export quality (FR-012).
- **Payment data:** all card data is handled exclusively by a PCI-compliant
  third-party provider; the app stores only a subscription reference/status and never
  touches raw card data.
- **Privacy logging:** the existing "never log raw answers, prompt, or draft content"
  rule extends to all new code paths (payment, entitlement, regeneration).

## Non-Functional Requirements

New (this release):

- Payment security: card data is handled only by a PCI-compliant third-party
  provider; the app never stores raw card data, only a subscription reference/status.
- Entitlement integrity: subscription status is server-authoritative; no client-side
  action can obtain Advanced generation without an active (or within-paid-period)
  subscription.
- Advanced generation timing: Advanced generation completes within a comparable,
  acceptable wait; the existing ~30s target is the bar, and a materially slower
  Advanced model is a flag, not an accepted default.
- Cookie/consent transparency: cookie usage is disclosed via the banner, and the
  banner reflects a real audit of which cookies the app actually sets.

Preserved (unchanged from MVP):

- Privacy: CV data and questionnaire answers remain accessible only to the
  authenticated owner.
- Export reliability & quality: PDF export remains readable and correctly formatted;
  no regression to the existing template.
- Simplicity: the main flow stays understandable for non-technical users; the paid
  choice never introduces technical jargon.
- Browser support: modern Chrome, Safari, Firefox, Edge on desktop and mobile.
- Accessibility: core flow remains keyboard-navigable with readable labels (new
  surfaces — pricing, cookie banner, Google button — included).
- Retention: saved CVs remain persistently available until the owner deletes them.

## Open Questions

Flagged during shaping for downstream resolution (`/10x-prd` mirrors these):

- **Conversion strength (FR-001/FR-011):** is an unlimited free tier plus a
  perceptible Advanced benefit enough to convert, or are soft conversion levers
  needed? Decide post-launch from real conversion data.
- **Basic→Advanced quality delta (FR-002/FR-004):** how to create and verify a
  genuinely tangible quality difference, and which concrete benefit to advertise as
  "Advanced." This is the core product risk of the release.
- **Cookie/privacy audit (FR-010):** enumerate the cookies the app actually sets
  (essential vs non-essential) to drive the banner's scope and any legal consent need.
- **Pricing validation (FR-005):** confirm willingness to pay at the ~$2–3 point
  before over-investing in landing-page polish.

## Non-Goals

- No ATS features in Wave 1: hidden ATS skills and advanced ATS features are deferred
  to Wave 2, even though ATS is half the long-term wedge. Wave 1 sells on the Advanced
  model alone.
- Subscription only — no pay-per-use: no one-time purchases or per-generation buys;
  the single paid path is the monthly subscription.
- No custom billing infrastructure: billing/payment is handled by a third-party
  provider, not built from scratch.
- No team / shared / org accounts and no multiple paid tiers: single-user accounts
  only; one paid tier ("Advanced").

Note: templates, photo, dark theme, candidate location/clickable contacts, and
page-count control are **sequenced into Wave 2–3** (see Forward block) but were
deliberately NOT hard-excluded — if Wave 1 lands early, one may be pulled forward.
They are roadmap sequencing, not a hard scope lock for the product.

## Product Framing

- Product type: web app (unchanged — no new product surface in this release).
- Target scale: dozens to a hundred users (unchanged), now with a paying subset
  carved out of the existing free audience.
- Timeline: after-hours work, no hard deadline; the full scope is sequenced into
  waves and shipped as ready, with Wave 1 (commercial core) as this release's
  committed slice.

## Quality cross-check

All 6 brownfield elements present, no gaps:

- Access Control: present — email/password preserved + Google linking + server-side
  entitlement.
- Business Logic: present — one-sentence new rule (subscription state decides the
  generation tier), existing transform rule preserved.
- Project artifacts: present — shape-notes.md with valid checkpoint frontmatter.
- Timeline-cost acknowledged: present — wave scope-down + Timeline acknowledgment.
- Non-Goals: present — 4 entries.
- Preserved behavior: present — Constraints & Preserved Behavior names every
  must-not-break item.

The 4 items in `## Open Questions` are intentional product risks for downstream
resolution, not quality-gate gaps. `quality_check_status: accepted`.

## Forward: roadmap waves

Informational hand-off for `/10x-roadmap` — NOT part of the PRD schema. The release
is sequenced into waves; this shape session's FRs/success bar cover **Wave 1** as the
committed scope. Wave 2–3 features are recorded here so they are not lost and so the
roadmap can pick them up as later vertical slices.

- **Wave 1 — Commercial core (this release's primary scope):**
  subscription/billing + entitlement, Basic/Advanced generation gating, stronger
  landing page (value + pricing + trust), cookie banner, Google login.
- **Wave 2 — ATS value & resume depth:** hidden ATS skills (100+ parser-visible
  skills without visual clutter), advanced ATS features (paid), candidate location &
  clickable contacts (LinkedIn/GitHub/portfolio/email/phone, clickable in PDF),
  resume page-count control (1 / 2 / Auto) with AI summarization/compression to fit.
- **Wave 3 — Presentation polish:** multiple resume templates (some photo-capable),
  optional photo support (template-dependent), dark theme.

(Note: subtle landing animations live with the Wave 1 landing-page work as a
nice-to-have, per the seed grouping — not deferred to Wave 3.)
