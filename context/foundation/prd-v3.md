---
project: AI CV Builder — Launch-Readiness & Validation Release
version: 3
status: draft
created: 2026-06-11
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

# PRD — AI CV Builder: Launch-Readiness & Validation Release (Brownfield)

> Scope note: this PRD covers **Wave A** — the launch-safe + measurable core (8 items).
> Wave B (internal admin metrics dashboard, contact/support page) is deferred and named in
> Non-Goals. Monetization is explicitly out of scope (see Non-Goals).

## Current System Overview

*This section describes the existing system as it is today; naming concrete technologies
here is intentional and permitted.*

- **System purpose (one sentence):** a shipped web app that turns a guided self-description
  questionnaire into a structured, professional CV that the user can edit and export to PDF.
- **Key architecture:** server-side-rendered web application running on a serverless edge
  runtime (Astro 6 SSR on Cloudflare Workers), with React 19 interactive islands.
- **Tech stack:** Astro 6, React 19, Tailwind 4, shadcn/ui ("new-york"); Supabase auth
  (email/password, cookie-based SSR sessions); OpenAI Chat Completions (`gpt-4o-mini`) with
  strict structured outputs for generation; PDF export via `@react-pdf/renderer`; Postgres
  (Supabase) holding `public.cvs` (JSONB draft + source snapshot, row-level-security
  owner-only) plus a **dormant, unused** `public.subscriptions` table and `entitlements.ts`
  service left over from earlier monetization scaffolding.
- **Current user base:** individual job seekers, students, career changers, and first-time
  workers; small scale (≤ ~100), currently pre-public (no real launch yet).
- **Core functionality today:** landing → AI-guided questionnaire → full CV generation →
  one clean professional template → section editing (Summary, Experience, Education, Skills,
  Languages) → save → PDF export → dashboard library of saved CVs. Email verification is
  **scaffolded but not enforced** (a confirmation page exists, but no gate prevents an
  unverified user from reaching the app). There is **no** social login, product analytics,
  error monitoring, legal/consent surface, account deletion, per-user generation cap,
  contact page, or admin view. Generation is protected only by a request-size cap.

## Problem Statement & Motivation

The product works mechanically, but it is **unvalidated and not safe to launch publicly**.
There is no evidence that real users complete the journey from landing to an exported CV and
find it valuable; there is no legal or consent surface; there is no visibility into failures
or user behavior; there is no protection against abuse; and a user has no way to delete their
account or data. These gaps are invisible "foundation" work that is cheap to skip and
expensive to retrofit after launch — which is precisely why they are still missing.

This change is needed **now** because the riskiest next move would be to build monetization
on top of an unproven funnel. Validating that the core funnel converts — and doing so safely
and legally — must come first; it de-risks every later product and revenue decision. There is
no current workaround: the safety, consent, observability, and account-lifecycle capabilities
simply do not exist yet.

## User & Persona

**Primary end-user persona (unchanged):** individuals across many situations — job seekers,
students, career changers, first-time workers — who are not confident starting from a blank
page. This release adds no capability they explicitly ask for; it adds the trust, safety, and
reliability they implicitly require before using a real product: a verified email, clear
privacy and terms, a way to delete their data, and reliable generation.

**New internal persona — the founder/operator:** a single operator who needs a lightweight,
read-only view of how the funnel is performing (total users, verified users, generated CVs,
daily generation volume, and feedback statistics) to judge whether the product is validated
and ready to monetize. *(The operator-facing dashboard itself is Wave B; the data it reads is
produced by this release.)*

## Success Criteria

### Primary

- A real new visitor completes the full funnel safely and measurably: they land on the
  product, register while accepting the Privacy Policy and Terms of Service (or sign in with
  Google), verify their email and reach the app, complete the questionnaire, generate a CV
  within the enforced daily limit, edit and save it, export a PDF, and leave Helpful /
  Not-Helpful feedback — with **every funnel step recorded as a tracked event**, any failure
  along the way **captured by centralized error monitoring**, and the user able to
  **permanently delete their account and all associated data**. The full existing flow keeps
  working unchanged for everyone. The release succeeds when the end-to-end funnel is live,
  safe, and fully instrumented.

### Secondary

- Funnel visibility is granular enough to show **drop-off between adjacent steps** (e.g.
  registered-but-never-verified, started-but-never-completed questionnaire), so the operator
  can see *where* the funnel leaks — not just end totals.

### Guardrails (must not break)

- The existing flow (questionnaire → generation → section editing → save → PDF export) keeps
  working unchanged for every user.
- Existing saved CVs and their data remain valid and openable.
- Existing accounts and active sessions keep working when verification enforcement and Google
  sign-in land — no forced re-authentication, no lockout of current users.
- Current PDF export quality does not regress.
- The "never retain raw answers, prompts, or draft content in operator-accessible storage"
  privacy commitment extends to every new capability (analytics, error monitoring, feedback,
  account deletion).
- The daily generation limit never blocks a legitimate user under normal use and shows a
  clear message — it is abuse protection, not a paywall.
- The previously-added, unused billing scaffolding stays inert; this release adds no billing
  behavior.

## User Stories

### US-01: New user completes the funnel safely and measurably

- **Given** a first-time visitor who wants to build a CV
- **When** they register (accepting the Privacy Policy and Terms of Service), verify their
  email, complete the questionnaire, generate a CV within the daily limit, save it, and export
  a PDF
- **Then** they reach a finished exported CV, each step is recorded as its funnel event, any
  failure is captured by error monitoring, and they can leave Helpful / Not-Helpful feedback.

#### Acceptance Criteria

- An unverified new user cannot reach the questionnaire, generation, or dashboard; they are
  directed to verify their email, with a way to resend the verification message.
- Registration cannot complete unless the Privacy Policy and Terms of Service are accepted.
- Each of the eight funnel steps (landing visit, registration, email confirmation,
  questionnaire started, questionnaire completed, CV generated, CV saved, PDF exported) is
  recorded as a distinct event.

### US-02: Returning user signs in with Google

- **Given** an existing user whose account email matches their Google account *(previously,
  only email/password sign-in existed)*
- **When** they choose "Sign in with Google"
- **Then** they are signed into their existing single account (not a duplicate), already
  satisfy the email-verification requirement, and all their previously saved CVs are available.

#### Acceptance Criteria

- A Google sign-in whose verified email matches an existing account resolves to that one
  profile; no second account is created.
- A Google-authenticated user is treated as having a verified email and is not asked to verify
  again.

### US-03: User permanently deletes their account

- **Given** a signed-in user who wants to leave *(previously, no self-service deletion
  existed)*
- **When** they confirm permanent account deletion through an explicit confirmation step
- **Then** their profile, CVs, questionnaire answers, sign-in identity, and associated personal
  data are removed with no recoverable copy retained, and they can no longer sign in to that
  account.

#### Acceptance Criteria

- Deletion requires an explicit, deliberate confirmation (not a single incidental click).
- After deletion, none of the user's personal data remains in any store the product controls,
  including identifying analytics data.

## Scope of Change

*Delta against the current system. Each item carries its originating requirement id; where
`/10x-shape` ran a Socratic challenge, the resolution is preserved verbatim.*

### Email verification

- **[modified]** FR-001: An unverified user is gated to a verify/resend state; only the
  landing, sign-in/sign-up, legal, and contact surfaces are reachable, and after clicking the
  verification link the account is marked verified and the user is sent to the login page. The
  gate is paired with a prominent resend action and clear inbox/spam guidance to minimize
  top-of-funnel drop. Priority: must-have.
  > Socrates: Counter-argument considered: "a hard wall loses users who never open the
  > verification email, suppressing the very funnel completion we want to validate."
  > Resolution: kept the hard wall but mandated strong resend + UX guidance — verified emails
  > are worth the friction, and the loss is mitigated, not ignored.
- **[new]** FR-002: A user can request the verification email be resent, protected against
  abuse so it cannot be used to flood an address. Priority: must-have.
  > Socrates: Counter-argument considered: "resend is redundant if email delivery is
  > reliable." Resolution: kept — deliverability is never 100% and resend is the recovery path
  > against permanent lockout; added abuse protection.

### Authentication (Google)

- **[new]** FR-003: A user can sign up and sign in with Google, alongside the existing
  email/password option. Priority: must-have.
  > Socrates: Counter-argument considered: "another sign-in option is maintenance + a new
  > failure surface for marginal gain pre-launch." Resolution: kept in Wave A — the marginal
  > cost is low and one-click signup measurably cuts top-of-funnel friction, directly serving
  > the validation goal.
- **[new]** FR-004: A Google sign-in whose verified email matches an existing account
  auto-links to that same single profile — one user, no duplicate account; linking occurs only
  when the email is verified on both sides. Priority: must-have.
  > Socrates: Counter-argument considered: "auto-linking by email risks an unintended merge /
  > account takeover." Resolution: kept the low-friction auto-link, constrained to
  > verified-on-both-sides only; Google-authenticated emails are provider-verified, closing
  > the takeover vector. Captured as a constraint in Constraints & Compatibility.

### Compliance & legal

- **[new]** FR-005: A visitor can view a dedicated Privacy Policy page that explains what user
  data is collected, stored, and processed, and explicitly discloses AI-assisted content
  generation. Its content is grounded in a real audit of actual data flows, not a stock
  template. Priority: must-have.
  > Socrates: Counter-argument considered: "a generic templated policy that doesn't match real
  > data flows is legal theater." Resolution: kept, with the requirement that the policy is
  > written from a real data-flow audit (see Open Questions), not a template.
- **[new]** FR-006: A visitor can view a dedicated Terms of Service page covering basic usage
  rules and liability limitations (including AI-output "as-is" / no-warranty framing).
  Priority: must-have.
  > Socrates: Counter-argument considered: "boilerplate ToS gives a solo product little real
  > liability protection." Resolution: kept lean-but-real as a baseline launch requirement;
  > flagged for legal review before scaling marketing (Open Questions).
- **[new]** FR-007: A user must accept the Privacy Policy and Terms of Service before an
  account can be created; registration is blocked without acceptance, and the accepted policy
  version and acceptance timestamp are recorded per user. Priority: must-have.
  > Socrates: Counter-argument considered: "a checkbox adds friction and isn't binding without
  > knowing which version was accepted when." Resolution: kept the mandatory gate and
  > strengthened it — record version + timestamp so consent is auditable and survives future
  > policy updates.

### Validation instrumentation

- **[new]** FR-008: The system records the key funnel events — landing visit, registration,
  email confirmation, questionnaire started, questionnaire completed, CV generated, CV saved,
  PDF exported — carrying only the funnel step plus a pseudonymous user/session identifier and
  coarse metadata, and **never** raw answers, prompts, or draft/CV content. Priority:
  must-have.
  > Socrates: Counter-argument considered: "funnel tracking risks capturing PII and
  > contradicting the privacy promise." Resolution: kept all 8 events but constrained payloads
  > to no-raw-content, pseudonymous-identifier only — the privacy commitment holds and the
  > policy stays honest.
- **[new]** FR-009: The system reports errors to a centralized monitor across four surfaces —
  frontend errors, backend/API failures, AI generation failures, and PDF export failures —
  with sensitive content (request bodies, prompts, answers, draft/CV content) removed before
  any report leaves the product. Priority: must-have.
  > Socrates: Counter-argument considered: "error payloads can leak raw answers/draft content
  > to a third-party monitor, violating the privacy commitment." Resolution: kept, with
  > mandatory scrubbing of sensitive fields before send — report only error type, location,
  > and non-sensitive metadata.
- **[new]** FR-010: After CV generation, a user can mark the result Helpful or Not Helpful and
  add an optional text comment; the feedback is stored (associated with the generation event
  identifier, but **not** storing CV/answer content with it) for product improvement.
  Priority: must-have.
  > Socrates: Counter-argument considered: "binary feedback is too coarse, and linking it to a
  > CV re-exposes content." Resolution: kept binary + optional comment for simplicity,
  > associated with the generation event identifier only — no CV/answer content stored
  > alongside.

### Operational hardening

- **[new]** FR-011: A user can permanently delete their account via an explicit confirmation
  step, which permanently removes their profile, CVs, questionnaire answers, sign-in identity,
  and associated personal data (including identifying analytics data) — no recoverable copy is
  retained. Priority: must-have.
  > Socrates: Counter-argument considered: "immediate permanent delete is irreversible and
  > must also purge the sign-in identity + analytics PII." Resolution: chose immediate
  > permanent deletion (clean erasure, no retention liability) gated behind a strong explicit
  > confirmation; a delayed/recoverable delete was rejected because holding "deleted" data
  > complicates the privacy promise.
- **[modified]** FR-012: The system enforces a limit of up to 100 CV generations per user per
  day with a clear message when reached, AND a coarse aggregate/cross-account abuse guard to
  cover the multi-account cost vector. The limit is authoritative and cannot be bypassed from
  the user's device. Priority: must-have.
  > Socrates: Counter-argument considered: "100/user/day stops little real abuse — a scripted
  > attacker just uses many accounts; the real cost vector is volume across accounts."
  > Resolution: kept the 100/user backstop AND added a coarse aggregate guard for the
  > cross-account vector. Exact aggregate thresholds flagged in Open Questions.

### Preserved (must not break)

- **[preserved]** FR-013: A user can complete the full existing flow (questionnaire →
  generation → section editing → save → PDF export) unchanged, and existing saved CVs remain
  valid and openable with no PDF export-quality regression; the existing path is guarded by
  regression tests so the new gates cannot silently break it. Priority: must-have.
  > Socrates: Counter-argument considered: "the new gates sit on the signup→app path, so
  > 'unchanged' is optimistic — regressions are likely." Resolution: kept as a hard guardrail
  > and made it verifiable by requiring regression tests around the existing
  > questionnaire→generate→save→export path.
- **[preserved]** FR-014: Existing accounts and active sessions continue to work unchanged
  after verification enforcement and Google sign-in land — no forced re-authentication, no
  lockout. Pre-launch accounts are grandfathered (treated as verified, or given a non-blocking
  re-verify prompt) so the verification requirement applies only to new signups. Priority:
  must-have.
  > Socrates: Counter-argument considered: "enforcing verification retroactively could lock out
  > existing unverified users." Resolution: grandfather existing accounts so the requirement
  > applies only to NEW signups — preventing mass lockout of current users. Captured as a
  > compatibility constraint in Constraints & Compatibility.

## Constraints & Compatibility

### Backward compatibility (must continue working)

- Existing saved CVs and their data remain valid and openable; the current PDF export path and
  its output quality are unaffected.
- Existing accounts and active sessions keep working — no forced re-authentication when
  verification enforcement and Google sign-in are introduced.
- The existing core flow (questionnaire → generation → editing → save → export) is preserved
  end-to-end and guarded by regression tests (FR-013).

### Data migration

- **Grandfathering existing accounts:** introducing the email-verification requirement must
  NOT lock out pre-launch accounts; they are migrated to a verified/grandfathered state (or
  given a non-blocking re-verify prompt) so only new signups face the wall (FR-014). The exact
  mechanism is an Open Question.
- **Additive only:** all new stored state (consent record, feedback, per-user daily usage
  count, any self-stored analytics) is added alongside existing data; it must not mutate
  existing CV records or their draft shape. Any structural data change ships with an explicit
  migration and rollback plan.

### Existing integrations / preserved behavior (explicitly named)

- The previously-added, unused billing scaffolding stays untouched and inert; this release adds
  no billing behavior and does not build the daily limit on top of it.
- Account deletion must also remove the user's sign-in identity (via a privileged deletion
  path), not only their CV data, leaving no recoverable copy across any store the product
  controls (FR-011).
- Google ↔ existing-account linking occurs only when the email is verified on both sides
  (FR-004).
- Each user can access only their own data; new user-scoped stores preserve strict owner-only
  isolation, and the operator metrics view (Wave B) exposes only aggregate figures, never raw
  CV/answer content.

### New quality properties the change must hold (outside-observable)

- **Privacy / data minimization:** analytics, error-monitoring, and feedback stores carry no
  raw answers, prompts, or draft/CV content; only pseudonymous identifiers and non-sensitive
  metadata leave the product.
- **Right to erasure:** a user-initiated account deletion completes promptly and removes all of
  that user's personal data across every store, with no recoverable copy retained.
- **Consent auditability:** for any account, the accepted Privacy/Terms version and acceptance
  timestamp are retrievable.
- **Observability:** errors across all four surfaces (frontend, API, AI generation, PDF export)
  become visible centrally within a short window; the eight funnel events are recorded reliably
  enough to compute step-to-step conversion and drop-off.
- **Verification reliability:** verification emails are deliverable and recoverable via an
  abuse-protected resend, so the requirement does not strand legitimate users.
- **Generation availability:** the daily limit never blocks a legitimate user under normal use
  and presents a clear message when reached; the new access gates do not materially slow page
  loads.

### Preserved quality properties (unchanged from today)

- **Privacy (owner-only):** CV data and questionnaire answers remain accessible only to the
  authenticated owner.
- **Export reliability & quality:** PDF export remains readable and correctly formatted.
- **Simplicity:** the main flow stays understandable for non-technical users; new surfaces do
  not add complexity to the core path.
- **Browser support:** the latest major versions of the four mainstream desktop browsers, plus
  mobile.
- **Accessibility:** the core flow plus the new user-facing surfaces (consent acceptance,
  Google sign-in, feedback capture, account-deletion confirmation, legal pages) remain
  keyboard-navigable with readable labels.
- **Retention:** saved CVs remain available until the owner deletes them or deletes their
  account.

## Business Logic Changes

**Existing content rule (preserved, unchanged):** the application transforms simple,
non-professional user answers into a structured, professional CV — deciding which information
is relevant, how it is phrased, and how it is organized into standard resume sections.

**This release adds no new content-generation rule.** It is primarily operational, compliance,
and observability infrastructure. What it adds are **governing policy rules** the product
applies:

- **Access rule:** only a verified account (or a grandfathered pre-launch account) may use the
  app; unverified new signups are held at a verify/resend state.
- **Usage rule:** a user may generate at most 100 CVs per day; beyond that the system refuses
  with a clear message, and a coarse aggregate guard caps abnormal cross-account volume. The
  decision is authoritative and is never made on the user's device.
- **Consent rule:** an account cannot be created without recorded acceptance of the current
  Privacy Policy and Terms of Service; the accepted version and timestamp are stored per user.
- **Erasure rule:** account deletion is a permanent erasure — it removes the user's profile,
  CVs, questionnaire answers, sign-in identity, and personal-data references (including
  identifying analytics data), leaving no recoverable copy.
- **Identity rule:** a verified email maps to exactly one profile; a Google sign-in with a
  matching verified email resolves to that same profile rather than creating a duplicate.

These are access, usage, and lifecycle policies layered on top of an existing domain rule —
not new content decisions.

## Access Control Changes

**Current model (preserved):** email/password authentication with persistent sessions; a flat
user model in which every signed-in user manages only their own CVs. Existing accounts and
sessions must keep working unchanged.

**Change 1 — enforce email verification (hard wall):** verification moves from scaffolded to
enforced for new signups. An unverified user may authenticate but is held at a "verify your
email / resend" state; only the landing, sign-in/sign-up, legal, and contact surfaces are
reachable until verified. After verifying, the user is sent to the login page. Enforcement is
authoritative and cannot be bypassed from the client. Pre-launch accounts are grandfathered
(FR-014).

**Change 2 — add Google sign-in with linking:** Google becomes a second sign-in option
alongside email/password. A Google sign-in whose verified email matches an existing account
auto-links to that same single profile — one profile regardless of sign-in method, no
duplicates — and a Google-authenticated email satisfies the verification requirement without a
separate step. Linking occurs only on emails verified on both sides.

**New operator access:** a single operator identity (a fixed, configured admin identity — no
role system, no RBAC) may view read-only aggregate metrics (Wave B). Operator checks are
authoritative and the view never exposes raw CV/answer content.

**New self-service:** every user can permanently delete their own account and associated data
(FR-011). The flat ownership model is otherwise unchanged.

## Non-Goals

- **No monetization of any kind** — no subscriptions, billing, paywalls, or premium AI tiers in
  this release; validating the funnel comes first. The dormant billing scaffolding stays inert.
- **No premium / presentation features** — no ATS enhancements, multiple templates, photo
  support, or dark mode; all deferred until the funnel is validated.
- **No formal roles / RBAC** — a single fixed operator identity only; no role system or
  multi-admin management surface.
- **No custom analytics / monitoring infrastructure built from scratch** — managed third-party
  tooling is used for analytics and error monitoring rather than building those systems
  in-house. *(The product-level decision is "don't build it"; the specific tool choice is a
  downstream stack-assessment concern.)*
- **Wave B deferred (sequencing, not a permanent exclusion):** the internal admin metrics
  dashboard and the contact/support page are deferred to a later wave, not removed from the
  product. If Wave A lands early, either may be pulled forward.

## Open Questions

1. **Privacy/data-flow audit (FR-005)** — before writing the Privacy Policy, enumerate the
   actual data flows (authentication data, CV/answer storage, AI processing by the generation
   service, the chosen analytics store, the chosen error monitor, feedback) so the policy
   reflects reality, not a template. Owner: user. Block: partial (Privacy Policy content
   depends on it).
2. **Terms of Service legal review (FR-006)** — ship a lean draft, but have it reviewed before
   scaling marketing. Owner: user / legal reviewer. By: before public marketing push.
3. **Analytics consent under GDPR (FR-008)** — confirm whether the GDPR-aligned posture plus
   the chosen analytics tool require a cookie/consent banner, or whether cookieless,
   pseudonymous tracking avoids the need. (No consent banner is currently in scope.) Owner:
   user. Block: no (affects compliance surface).
4. **Verification email deliverability (FR-001/FR-002)** — confirm whether the existing
   built-in email sending is sufficient at launch volume or whether a dedicated transactional
   email capability is needed for reliable verification. Owner: user (resolve in
   stack-assessment). Block: no.
5. **Aggregate abuse-guard thresholds (FR-012)** — set the concrete numbers for the coarse
   aggregate/cross-account generation ceiling and any single-origin signup throttle. Owner:
   user. Block: no.
6. **Grandfathering mechanism (FR-014)** — decide exactly how pre-launch accounts are marked
   verified (one-time data migration vs. a gating exception) without forcing re-authentication.
   Owner: user. Block: no.
7. **Delivery timeline (frontmatter `timeline_budget.delivery_weeks: null`)** — intentionally
   unset: the work is after-hours with no hard deadline and is sequenced into waves rather than
   estimated as a single delivery-week count. Owner: user. Block: no (deliberate, not a gap).
