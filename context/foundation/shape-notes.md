---
project: AI CV Builder — Launch-Readiness & Validation Release
context_type: brownfield
created: 2026-06-11
updated: 2026-06-11
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: context type
      decision: brownfield
    - topic: admin persona
      decision: single founder/admin (hardcoded email, no RBAC)
    - topic: validation north-star
      decision: end-to-end funnel completion (visit → register → generate → export)
    - topic: dormant monetization scaffolding
      decision: leave subscriptions table + entitlements service untouched; daily limit built separately
    - topic: email-verification enforcement boundary
      decision: hard wall — unverified users gated to verify/resend page; only landing/auth/legal/contact reachable
    - topic: Google account linking
      decision: auto-link on verified email (single profile, no duplicate account)
    - topic: release scope cut (waves)
      decision: "Wave A (committed, 8): email verification+resend, Privacy+ToS+terms,
        daily generation cap, account deletion, analytics funnel, error monitoring,
        Google login, post-generation feedback. Wave B (deferred): admin dashboard,
        contact page."
    - topic: data-protection posture
      decision: GDPR-aligned (EU users in scope; tooling favors transparency + residency)
  frs_drafted: 14
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

# Shape Notes — Launch-Readiness & Validation Release (Brownfield)

Seed idea: Before introducing subscriptions or any monetization, make the existing AI
CV Builder ready for a real public launch and able to **validate** that users
successfully register, generate CVs, export them, and find value. Twelve launch-critical
items: (1) enforced email confirmation, (2) Google login, (3) Privacy Policy page,
(4) Terms of Service page, (5) mandatory terms acceptance at registration, (6) product
analytics over the key funnel, (7) centralized error monitoring, (8) post-generation
user feedback, (9) account deletion, (10) server-side daily generation limit (100/user/
day), (11) contact/support page, (12) lightweight internal admin metrics dashboard.
Explicitly deferred until validated: subscriptions, premium AI models, ATS features,
multiple templates, photos, dark mode.

## Current System

The product is a shipped Astro 6 SSR web app (React 19 islands, Tailwind 4, shadcn/ui
"new-york"), deployed to Cloudflare Workers, with Supabase auth.

- **Auth:** Supabase email/password only. `signin` / `signup` / `confirm-email` pages
  exist, but email verification is **scaffolded, not enforced** — the confirm-email page
  is informational and no middleware gate checks `email_confirmed_at`; a user can reach
  `/dashboard` unverified. No resend-verification flow. No social/OAuth provider.
- **AI generation:** OpenAI Chat Completions, hardcoded `gpt-4o-mini`, strict structured
  outputs, ~25s timeout, called via `fetch` (Workers runtime). Privacy contract: never
  logs raw answers, prompt, or draft content. The generate endpoint enforces only a 40KB
  request-body cap — **no per-user daily limit**.
- **Data:** `public.cvs` (JSONB `draft` + JSONB `source_snapshot`, RLS owner-only) and
  `public.subscriptions` (+ `get_entitlement()` SQL fn and `entitlements.ts` service) —
  the latter is **dormant monetization scaffolding that already landed in code but is
  unused**. No tables for analytics, feedback, or terms acceptance.
- **Core flow:** landing → AI-guided questionnaire → full CV generation → one clean
  professional template → section-based editing (Summary, Experience, Education, Skills,
  Languages) → save → PDF export (`@react-pdf/renderer`) → dashboard library.
- **Routes today:** `/` · `/auth/{signin,signup,confirm-email}` · `/dashboard` ·
  `/cv/new` · `/cv/[id]`. CV deletion exists (`DELETE /api/cv/[id]`); **no account
  deletion**. No analytics, error monitoring, legal pages, contact page, or admin.

**Absent today (the change surface):** enforced email verification + resend, Google
OAuth, Privacy Policy & ToS pages, registration terms acceptance, product analytics,
error monitoring, post-generation feedback, account deletion, server-side daily
generation cap, contact/support page, internal admin metrics dashboard.

## Vision & Problem Statement

The MVP proves, mechanically, that guided self-description can produce a usable CV. But
it is **unvalidated and not safe to launch publicly**: there is no proof that real users
get all the way from landing to an exported CV and find it valuable, no legal/consent
surface, no observability into failures or behavior, no abuse protection, and no way for
a user to delete their account.

**The delta — what's changing and why:** build the launch-readiness foundation *before*
monetization. This release does not sell anything; it makes the product safe to put in
front of real users and instruments it so the team can **validate the core funnel**.
Concretely: enforce email verification and add Google login (auth completeness); ship
Privacy Policy + Terms of Service + mandatory terms acceptance (trust & compliance,
including explicit disclosure of AI-assisted generation); instrument the funnel with
product analytics, post-generation feedback, and centralized error monitoring
(validation instrumentation); add account deletion and a server-side daily generation
cap (operational hardening); add a contact/support page and a lightweight internal admin
metrics dashboard.

**North-star (what "validated" means):** **end-to-end funnel completion** — real
visitors getting from landing → registration → questionnaire → CV generated → PDF
exported. The analytics funnel, feedback, and admin dashboard exist primarily to make
that conversion measurable. Once it is green, monetization can be prioritized from real
data with much higher confidence.

**Insight:** the riskiest thing to do next is build monetization on top of an unproven
funnel. Validation-first is cheaper than premium features and de-risks every later bet —
but it is invisible work (consent, observability, account lifecycle) that is easy to skip
and expensive to retrofit after launch, which is why it has not been done yet.

## User & Persona

**Primary (end-user) persona unchanged:** individuals across many orgs — job seekers,
students, career changers, first-time workers — who are not confident starting from a
blank page. This release adds no new capability they *ask* for; it adds the trust,
safety, and reliability they implicitly require before using a real product (verified
email, clear privacy/terms, a way to delete their data, reliable generation).

**New internal persona — the founder/operator (you):** a single admin (hardcoded admin
email, no role system) who needs a lightweight read-only view of how the funnel is
performing — total users, verified users, generated CVs, daily generation volume, and
feedback statistics — to decide whether the product is validated and ready to monetize.

## Access Control

**Current model (preserved):** Supabase email/password auth, cookie-based SSR sessions,
flat user model — every signed-in user manages only their own CVs (RLS owner-only on
`public.cvs`). Existing accounts and sessions must keep working unchanged.

**Auth change 1 — enforce email verification (hard wall):** verification moves from
scaffolded to enforced. An unverified user may authenticate but is redirected to a
"verify your email / resend link" state; only the landing page, auth pages, the legal
pages (Privacy/ToS), and the contact page are reachable while unverified — no dashboard,
questionnaire, or generation. After clicking the verification link the account is marked
verified and the user is redirected to the login page (per brief). A resend-verification
action is available. Enforcement is server-side in middleware (checks `email_confirmed_at`),
never a client-only gate.

**Auth change 2 — add Google login with linking:** Google OAuth becomes a second sign-in
option alongside email/password (Supabase OAuth provider). A Google sign-in whose
(Google-verified) email matches an existing account **auto-links to that same single
profile** — one user profile regardless of auth method, no duplicate accounts. Linking
only occurs on verified emails on both sides. Google-authenticated emails are inherently
verified, so they satisfy the verification wall without a separate confirmation step.

**Admin access:** a single founder/admin identified by a **hardcoded admin email** (no
role column, no RBAC). Admin-only routes (the metrics dashboard) check the authenticated
user's email against that constant, server-side. The dashboard is read-only; it never
exposes raw CV/answer content (see privacy constraints).

**Account self-service:** every user can permanently delete their own account and
associated data (see Business Logic). No change to the flat ownership model otherwise.

## Success Criteria

Scoped to **Wave A — launch-safe + measurable core** (8 items). Wave B (admin dashboard,
contact page) is captured under `## Forward: roadmap waves` and is explicitly out of this
release's primary success bar.

### Primary

- A real new visitor completes the full funnel safely and measurably: they land on the
  product, register while accepting Privacy + ToS (or sign in with Google), verify their
  email and reach the app, complete the questionnaire, generate a CV (within the
  server-enforced daily cap), edit and save it, export a PDF, and leave Helpful/
  Not-Helpful feedback — with **every funnel step emitted as a tracked event**, any
  failure along the way **captured by centralized error monitoring**, and the user able
  to **permanently delete their account and all associated data**. The full existing free
  flow continues to work unchanged for everyone. The release succeeds when the end-to-end
  funnel is live, safe, and fully instrumented.

### Secondary

- Funnel visibility is granular enough to show **drop-off between adjacent steps** (e.g.
  registered-but-never-verified, started-but-never-completed questionnaire), so the
  founder can see *where* the funnel leaks — not just end totals.

### Guardrails (must not break)

- The existing free flow (questionnaire → generation → section editing → save → PDF
  export) keeps working unchanged for every user.
- Existing saved CVs and `public.cvs` data remain valid and openable.
- Existing email/password accounts and sessions keep working when verification
  enforcement and Google login land (no forced re-auth, no lockout of current users).
- Current PDF export quality does not regress.
- The "never log raw answers, prompt, or draft content" privacy contract extends to every
  new code path (analytics, error monitoring, feedback, account deletion).
- The daily generation cap (100/user/day) never blocks a legitimate user under normal use
  and shows a clear message — it is abuse protection, not a paywall.
- The dormant `public.subscriptions` / entitlements scaffolding stays untouched and
  inert; this release adds no billing behavior.

## Timeline acknowledgment

Acknowledged on 2026-06-11: the full 12-item launch-readiness scope exceeds a few weeks
of after-hours work. Cost surfaced (brownfield half-done risk). The user **scoped the
release into waves**, committing to Wave A (8 launch-safe + measurable items) as the
first sellable-readiness slice and deferring the admin dashboard + contact page to Wave B.
Wave A itself is still a multi-week, after-hours effort; the user accepts that sustained
cost. No hard deadline; ship Wave A, then Wave B, as ready.

## Functional Requirements

Scope: **Wave A — launch-safe + measurable core.** Wave B capabilities (admin dashboard,
contact page) live in `## Forward: roadmap waves` and become FRs when that wave is planned.

### Email verification

- FR-001: An unverified user is gated server-side (middleware) to a verify/resend state;
  only landing, auth, legal, and contact pages are reachable, and after clicking the
  verification link the account is marked verified and the user is redirected to the
  login page. The wall is paired with a prominent resend action and clear inbox/spam
  guidance to minimize top-of-funnel drop. Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "a hard wall loses users who never open the
  > verification email, suppressing the very funnel completion we want to validate."
  > Resolution: kept the hard wall but mandated strong resend + UX guidance — verified
  > emails are worth the friction, and the loss is mitigated, not ignored.
- FR-002: A user can request the verification email be resent, rate-limited so the action
  cannot be used to spam-bomb an address. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "resend is redundant if email delivery is
  > reliable." Resolution: kept — deliverability is never 100% and resend is the recovery
  > path against permanent lockout; added a rate limit to prevent abuse.

### Authentication (Google)

- FR-003: A user can sign up and sign in with Google, alongside the existing
  email/password option. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "another auth provider is maintenance + a new
  > failure surface for marginal gain pre-launch." Resolution: kept in Wave A — Supabase
  > supports the provider natively (low marginal cost) and one-click signup measurably
  > cuts top-of-funnel friction, directly serving the validation goal.
- FR-004: A Google sign-in whose (Google-verified) email matches an existing account
  auto-links to that same single profile — one user, no duplicate account; linking occurs
  only when the email is verified on both sides. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "auto-linking by email risks an unintended
  > merge / account takeover." Resolution: kept the low-friction auto-link, constrained to
  > verified-on-both-sides only; Google emails are provider-verified, closing the takeover
  > vector. Captured as a security constraint in Constraints & Preserved Behavior.

### Compliance & legal

- FR-005: A visitor can view a dedicated Privacy Policy page that explains what user data
  is collected, stored, and processed, and explicitly discloses AI-assisted content
  generation. Its content is grounded in a real audit of actual data flows (Supabase auth
  data, CV/answer JSONB, OpenAI processing, analytics, error monitoring). Priority:
  must-have. Change: new
  > Socrates: Counter-argument considered: "a generic templated policy that doesn't match
  > real data flows is legal theater." Resolution: kept, with the requirement that the
  > policy is written from a real data-flow audit (see Open Questions: privacy/data audit),
  > not a stock template.
- FR-006: A visitor can view a dedicated Terms of Service page covering basic usage rules
  and liability limitations (including AI-output "as-is" / no-warranty framing). Priority:
  must-have. Change: new
  > Socrates: Counter-argument considered: "boilerplate ToS gives a solo product little
  > real liability protection." Resolution: kept lean-but-real as a baseline launch
  > requirement; flagged for legal review before scaling marketing (Open Questions).
- FR-007: A user must accept the Privacy Policy and Terms of Service (mandatory checkbox)
  before an account can be created; registration is blocked without acceptance, and the
  **accepted policy version and acceptance timestamp are recorded per user**. Priority:
  must-have. Change: new
  > Socrates: Counter-argument considered: "a checkbox adds friction and isn't binding
  > without knowing which version was accepted when." Resolution: kept the mandatory gate
  > and strengthened it — record version + timestamp so consent is auditable and survives
  > future policy updates.

### Validation instrumentation

- FR-008: The system tracks the key funnel events — landing visit, registration, email
  confirmation, questionnaire started, questionnaire completed, CV generated, CV saved,
  PDF exported — carrying only the funnel step plus a pseudonymous user/session id and
  coarse metadata, and **never** raw answers, prompts, or draft/CV content. Priority:
  must-have. Change: new
  > Socrates: Counter-argument considered: "funnel tracking risks capturing PII and
  > contradicting the privacy promise." Resolution: kept all 8 events but constrained
  > payloads to no-raw-content, pseudonymous-id only — the never-log contract holds and
  > the privacy policy stays honest.
- FR-009: The system reports errors to a centralized monitor across four surfaces —
  frontend errors, backend/API failures, AI generation failures, and PDF export failures —
  with sensitive content (request bodies, prompts, answers, draft/CV content) scrubbed
  before any report leaves the app. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "error payloads can leak raw answers/draft
  > content to a third-party monitor, violating the never-log contract." Resolution: kept,
  > with mandatory scrubbing/redaction of sensitive fields before send — report only error
  > type, location, and non-sensitive metadata.
- FR-010: After CV generation, a user can mark the result Helpful or Not Helpful and add
  an optional text comment; the feedback is stored (linked to the generation event id, but
  **not** storing CV/answer content with it) for product improvement. Priority: must-have.
  Change: new
  > Socrates: Counter-argument considered: "binary feedback is too coarse, and linking it
  > to a CV re-exposes content." Resolution: kept binary + optional comment for simplicity,
  > linked to the generation event id only — no CV/answer content stored alongside.

### Operational hardening

- FR-011: A user can permanently delete their account via an explicit confirmation step
  (e.g. type-to-confirm / re-auth), which **hard-deletes** their user profile, CVs,
  questionnaire answers, auth record, and associated personal data (including analytics
  PII references) — no recoverable copy is retained. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "immediate hard delete is irreversible and must
  > also purge the auth record + analytics PII." Resolution: chose immediate hard delete
  > (GDPR-clean, no retention liability) gated behind a strong explicit confirmation;
  > soft-delete rejected because holding 'deleted' data complicates the privacy promise.
- FR-012: The system enforces, server-side, a limit of up to 100 CV generations per user
  per day with a clear message when reached, AND a coarse global/cross-account abuse guard
  (e.g. a total daily generation ceiling and/or per-IP signup throttle) to cover the
  multi-account cost vector. Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: "100/user/day stops little real abuse — a
  > scripted attacker just uses many accounts; the real cost vector is volume across
  > accounts." Resolution: kept the 100/user backstop AND added a coarse global guard for
  > the cross-account vector. Exact global thresholds flagged in Open Questions.

### Preserved core

- FR-013: A user can complete the full existing flow (questionnaire → generation →
  section editing → save → PDF export) unchanged, and existing saved CVs remain valid and
  openable with no PDF export-quality regression; the existing path is guarded by
  regression tests so the new gates cannot silently break it. Priority: must-have.
  Change: preserved
  > Socrates: Counter-argument considered: "the new gates sit on the signup→app path, so
  > 'unchanged' is optimistic — regressions are likely." Resolution: kept as a hard
  > guardrail and made it verifiable by requiring regression tests around the existing
  > questionnaire→generate→save→export path.
- FR-014: Existing email/password accounts and sessions continue to work unchanged after
  verification enforcement and Google login land — no forced re-auth, no lockout.
  **Pre-launch accounts are grandfathered** (treated as verified, or given a non-blocking
  re-verify prompt) so the verification wall applies only to new signups. Priority:
  must-have. Change: preserved
  > Socrates: Counter-argument considered: "enforcing verification retroactively could lock
  > out existing unverified users." Resolution: grandfather existing accounts so the wall
  > applies only to NEW signups — preventing mass lockout of current users. Captured as a
  > migration constraint in Constraints & Preserved Behavior.

## User Stories

### US-01: New user completes the funnel safely and measurably

- **Given** a first-time visitor who wants to build a CV
- **When** they register (accepting Privacy + ToS), verify their email, complete the
  questionnaire, generate a CV within the daily limit, save it, and export a PDF
- **Then** they reach a finished exported CV, each step emits its funnel event, any
  failure is captured by error monitoring, and they can leave Helpful/Not-Helpful feedback.

### US-02: Returning user signs in with Google

- **Given** an existing user whose account email matches their Google account
- **When** they choose "Sign in with Google"
- **Then** they are signed into their existing single account (not a duplicate), already
  satisfy the verification wall, and all their previously saved CVs are available.

### US-03: User deletes their account

- **Given** a signed-in user who wants to leave
- **When** they confirm permanent account deletion
- **Then** their profile, CVs, questionnaire answers, and associated personal data are
  removed, and they can no longer sign in to that account.

## Business Logic

**Existing content rule (preserved):** the application transforms simple, non-professional
user answers into a structured, professional CV — deciding which information is relevant,
how it is phrased, and how it is organized into standard resume sections. This release
does **not** change it.

**This release adds no new content-generation rule** — it is primarily operational,
compliance, and observability infrastructure. What it does add are **governing policy
rules** the system applies:

- **Access rule:** only a verified account (or a grandfathered pre-launch account) may use
  the app; unverified new signups are gated to a verify/resend state. Enforced
  server-side.
- **Usage rule:** a user may generate at most 100 CVs per day; beyond that the system
  refuses with a clear message. A coarse global/cross-account guard also caps abnormal
  aggregate volume. Server-authoritative; the client never decides the limit.
- **Consent rule:** an account cannot be created without recorded acceptance of the
  current Privacy Policy and Terms of Service; the accepted version and timestamp are
  stored per user.
- **Erasure rule:** account deletion is a hard delete — it removes the user's profile,
  CVs, questionnaire answers, auth record, and personal-data references (including
  analytics PII), leaving no recoverable copy.
- **Identity rule:** a verified email maps to exactly one profile; a Google sign-in with a
  matching verified email resolves to that same profile rather than creating a duplicate.

All of these are access/usage/lifecycle policy, not new domain content decisions; the
empty-CRUD concern does not apply (this is brownfield infrastructure on top of an existing
domain rule).

## Constraints & Preserved Behavior

- **Runtime constraint (Cloudflare Workers):** all new server code — middleware
  verification gate, OAuth callback handling, analytics emission, error reporting,
  account-deletion, usage-counting — must use `fetch`-compatible, Workers-safe approaches
  with no Node-only SDKs, consistent with the existing `cv-generation.ts` pattern. **This
  constrains tool selection:** any analytics / error-monitoring client chosen downstream
  must have a Workers-compatible (edge/HTTP) integration path.
- **GDPR-aligned data posture:** EU/EEA users are treated as in-scope — the Privacy Policy
  discloses data collected/stored/processed and AI-assisted generation; right-to-erasure
  is satisfied by FR-011; analytics/error/feedback tooling chosen downstream should support
  this posture (data-handling transparency, and where feasible favorable data residency).
- **Privacy logging contract (extended):** the existing "never log raw answers, prompt, or
  draft content" rule extends to every new code path — analytics events carry no raw
  content (FR-008), error reports are scrubbed before send (FR-009), feedback stores no CV/
  answer content (FR-010).
- **Additive data model:** new state (terms-acceptance record, feedback, per-user daily
  usage counter, any self-stored analytics) is stored additively in new tables/columns
  keyed to the user; it must never mutate existing `public.cvs` rows or the
  `GeneratedCvDraft` shape. Any schema change ships with an explicit migration plan.
- **RLS convention:** new user-scoped tables enable row-level security with owner-only,
  per-operation policies, matching the existing `public.cvs` convention. The
  analytics/feedback/admin read paths must not expose one user's data to another.
- **Auth migration constraint (grandfathering):** enforcing the verification wall must NOT
  lock out existing pre-launch accounts — they are grandfathered (treated as verified or
  given a non-blocking re-verify prompt). Existing email/password sessions are preserved
  with no forced re-auth (FR-014).
- **Account-linking constraint:** Google↔existing-account linking occurs only on emails
  verified on both sides (FR-004).
- **Account-deletion mechanics:** hard deletion must purge the Supabase `auth.users` record
  (requires a privileged/service-role server call) in addition to `public.cvs` and all new
  user-scoped tables, plus any analytics PII reference.
- **Admin constraint:** the admin metrics view (Wave B) and any admin read paths must be
  gated by the hardcoded admin-email check server-side and must surface only aggregate
  metrics — never raw CV/answer content.
- **Dormant scaffolding:** the existing `public.subscriptions` table, `get_entitlement()`
  function, and `entitlements.ts` service stay untouched and inert; this release adds no
  billing behavior and does not build the daily limit on top of them.
- **Export isolation:** the current single-template PDF export path stays intact; no change
  in this release may regress its quality (FR-013).

## Non-Functional Requirements

New (this release):

- **Privacy / data minimization:** analytics, error-monitoring, and feedback stores carry
  no raw answers, prompts, or draft/CV content; only pseudonymous ids and non-sensitive
  metadata leave the app.
- **Right to erasure:** a user-initiated account deletion completes promptly and removes
  all of that user's personal data across every store, with no recoverable copy retained.
- **Consent auditability:** for any account, the accepted Privacy/ToS version and
  acceptance timestamp are retrievable.
- **Observability:** errors across all four surfaces (frontend, API, AI generation, PDF
  export) are visible centrally within a short window; the eight funnel events are recorded
  reliably enough to compute step-to-step conversion and drop-off.
- **Verification reliability:** verification emails are deliverable and recoverable via a
  rate-limited resend, so the wall does not strand legitimate users.
- **Generation availability:** the daily cap never blocks a legitimate user under normal
  use and presents a clear message when reached; new middleware gates do not materially
  slow page loads.

Preserved (unchanged from MVP):

- **Privacy (owner-only):** CV data and questionnaire answers remain accessible only to the
  authenticated owner.
- **Export reliability & quality:** PDF export remains readable and correctly formatted; no
  regression to the existing template.
- **Simplicity:** the main flow stays understandable for non-technical users; new surfaces
  (consent checkbox, Google button, feedback widget, delete-account flow) do not add
  complexity to the core path.
- **Browser support:** modern Chrome, Safari, Firefox, Edge on desktop and mobile.
- **Accessibility:** core flow plus new surfaces (legal pages, consent checkbox, Google
  button, feedback widget, delete-account confirmation) remain keyboard-navigable with
  readable labels.
- **Retention:** saved CVs remain persistently available until the owner deletes them or
  deletes their account.

## Open Questions

Flagged during shaping for downstream resolution (`/10x-prd` mirrors these):

- **Privacy/data-flow audit (FR-005):** before writing the Privacy Policy, enumerate the
  actual data flows — Supabase auth data, `public.cvs` JSONB, OpenAI processing, the chosen
  analytics store, the chosen error monitor, feedback — so the policy reflects reality, not
  a template.
- **ToS legal review (FR-006):** ship a lean draft, but have it reviewed before scaling
  marketing.
- **Analytics consent under GDPR (FR-008):** confirm whether the GDPR-aligned posture +
  the chosen analytics tool require a cookie/consent banner, or whether cookieless,
  pseudonymous tracking avoids the need. (No cookie banner is currently in scope.)
- **Verification email deliverability (FR-001/FR-002):** Supabase's built-in email has low
  sending limits; confirm whether a dedicated transactional-email provider is needed for
  reliable verification at launch volume.
- **Global abuse-guard thresholds (FR-012):** set the concrete numbers for the coarse
  global/cross-account generation ceiling and any per-IP signup throttle.
- **Grandfathering mechanics (FR-014):** decide exactly how pre-launch accounts are marked
  verified (one-time migration vs. middleware exception) without forcing re-auth.

## Non-Goals

- **No monetization of any kind** — no subscriptions, billing, paywalls, or premium AI
  tiers in this release; validating the funnel comes first. The dormant `public.subscriptions`
  / entitlements scaffolding stays inert.
- **No premium / presentation features** — no ATS enhancements, multiple templates, photo
  support, or dark mode; all deferred until the funnel is validated.
- **No RBAC / formal admin roles** — a single hardcoded admin only; no role system or
  multi-admin management UI.
- **No custom analytics / monitoring infrastructure** — use managed, Workers-compatible
  third-party tooling rather than building analytics or error monitoring from scratch.

Note: the **admin dashboard** and **contact page** are deferred to **Wave B** (see Forward
block), not hard-excluded from the product — they are sequencing, not a permanent scope
lock. If Wave A lands early, either may be pulled forward.

## Product Framing

- **Product type:** web app (unchanged — no new product surface in this release).
- **Target scale:** dozens to a hundred users (unchanged), now being prepared for its first
  real public, non-invited users.
- **Timeline:** after-hours work, no hard deadline; the 12-item scope is sequenced into
  waves and shipped as ready, with Wave A (8 launch-safe + measurable items) as this
  release's committed slice.

## Forward: roadmap waves

Informational hand-off for `/10x-roadmap` — NOT part of the PRD schema. This release is
sequenced into waves; this shape session's FRs/success bar cover **Wave A** as the
committed scope.

- **Wave A — Launch-safe + measurable core (this release's primary scope):** enforced
  email verification + rate-limited resend, Google login + verified-email auto-linking,
  Privacy Policy + Terms of Service + mandatory versioned terms acceptance, product
  analytics over the 8 funnel events, centralized error monitoring (4 surfaces, scrubbed),
  post-generation Helpful/Not-Helpful feedback, permanent account deletion, server-side
  daily generation cap (100/user/day) + coarse global abuse guard.
- **Wave B — Operator tooling & support surface:** lightweight internal admin metrics
  dashboard (total users, verified users, generated CVs, daily generation volume, feedback
  statistics — gated by hardcoded admin email, aggregate-only), contact/support page
  (support email + basic contact form).
- **Later (post-validation, explicitly deferred):** monetization — subscriptions, premium
  AI models, ATS enhancements, multiple templates, photo support, dark mode. These are
  prioritized from real usage data only after the funnel is validated (see the archived
  "Commercial Readiness" shape notes for the prior monetization shaping).

## Forward: tech-stack

Informational hand-off — NOT part of the PRD schema. Tooling decisions are made downstream
(`/10x-stack-assess` / tool selection), but this release imposes hard selection constraints:

- **Analytics + error-monitoring tools must be Cloudflare-Workers-compatible** (edge/HTTP
  integration, no Node-only SDK) and **GDPR-aligned** (data-handling transparency, no raw
  content, favorable residency where feasible). Self-hosting/building is a non-goal.
- **Google login** uses Supabase's native OAuth provider (no new auth framework).
- **Transactional email:** evaluate a dedicated provider for verification emails if
  Supabase's built-in sending limits prove inadequate at launch volume.
- **Account deletion** requires a privileged/service-role server path to purge
  `auth.users`, runnable from the Workers runtime.

## Quality cross-check

All 6 brownfield elements present, no gaps:

- Access Control: present — email/password preserved + enforced verification wall +
  Google verified-email auto-linking + hardcoded-admin gate + self-service deletion.
- Business Logic: present — existing one-sentence content rule preserved; new governing
  policy rules captured (access / usage / consent / erasure / identity). Not a new content
  rule — brownfield infrastructure on an existing domain rule, so empty-CRUD does not apply.
- Project artifacts: present — shape-notes.md with valid checkpoint frontmatter.
- Timeline-cost acknowledged: present — 12→8 wave scope-down + Timeline acknowledgment.
- Non-Goals: present — 4 entries.
- Preserved behavior: present — Constraints & Preserved Behavior names every must-not-break
  item (existing flow, saved CVs/data, sessions, PDF export, privacy contract, dormant
  billing scaffolding, grandfathered accounts).

The 6 items in `## Open Questions` are intentional product/legal risks for downstream
resolution, not quality-gate gaps. `quality_check_status: accepted`.
