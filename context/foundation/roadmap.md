---
project: AI CV Builder — Launch-Readiness & Validation Release
version: 1
status: draft
created: 2026-06-11
updated: 2026-08-09
prd_version: 3
main_goal: market-feedback
top_blocker: capacity
---

# Roadmap: AI CV Builder — Launch-Readiness & Validation Release

> Derived from `context/foundation/prd-v3.md` (v3) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

The CV builder works mechanically — landing → questionnaire → AI generation → edit → save → PDF export — but it is unvalidated and not safe to launch publicly: no proof real users complete the funnel, no legal/consent surface, no failure visibility, no abuse protection, and no way to delete an account. This Wave A release adds the trust, safety, and measurability the product needs before monetization can sit on top of it. The **riskiest assumption** (the single belief whose failure would invalidate the plan) is that the funnel actually converts end-to-end — so the release is sequenced to make that conversion _measurable_ first, then make it _safe and legal_ to put in front of real users.

## North star

**S-01: every funnel step from landing to PDF export is recorded as a tracked event** — with `market-feedback` as the goal, this is the validation milestone: it turns the existing (already-working) funnel into something whose conversion and drop-off can be _seen_, which is the entire point of the release.

> "North star" here means the smallest end-to-end slice whose successful delivery would prove the core product hypothesis — placed as early as Prerequisites allow because everything else only matters if the funnel converts. It depends only on the observability foundation (F-01); nothing user-facing blocks it.

## At a glance

| ID   | Change ID                      | Outcome (user can …)                                                                                                | Prerequisites | PRD refs                      | Status      |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------- | ----------- |
| F-01 | observability-baseline         | (foundation) managed analytics + error-monitor provisioned; pseudonymous no-raw-content recording contract in place | —             | FR-008, FR-009, FR-010        | done        |
| F-02 | core-flow-regression-net       | (foundation) existing questionnaire→generate→save→export path guarded by regression tests                           | —             | FR-013                        | done        |
| S-01 | funnel-event-instrumentation   | (operator) see a real user move through all 8 funnel steps as tracked events                                        | F-01          | FR-008, US-01                 | done        |
| S-02 | enforce-email-verification     | verify their email behind a hard wall, resend it, existing accounts grandfathered                                   | F-02          | FR-001, FR-002, FR-014, US-01 | done        |
| S-03 | consent-gated-registration     | accept the combined Privacy + Terms consent to register (gate enforced client + server)                             | F-02          | FR-005, FR-006, FR-007, US-01 | done (gate) |
| S-04 | google-signin-linking          | sign in with Google into their one existing account (no duplicate)                                                  | S-02          | FR-003, FR-004, US-02         | done        |
| S-05 | post-generation-feedback       | mark a generated CV Helpful / Not-Helpful with an optional comment                                                  | F-01          | FR-010, US-01                 | done        |
| S-06 | daily-generation-limit         | be limited to 100 generations/day with a clear message; cross-account abuse capped                                  | F-02          | FR-012                        | done        |
| S-07 | centralized-error-monitoring   | (operator) see failures across all 4 surfaces, scrubbed of sensitive content                                        | F-01          | FR-009                        | done        |
| S-08 | account-deletion               | permanently delete their account and all associated data via explicit confirmation                                  | F-01          | FR-011, US-03                 | done        |
| S-09 | legal-pages-and-consent-record | read the real Privacy + Terms pages and have their accepted policy version + acceptance timestamp recorded          | S-03          | FR-005, FR-006, FR-007        | done        |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                       | Chain                                                                  | Note                                                                                                                                                                                       |
| ------ | --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A      | Measurement & observability | `F-01` → `S-01` → (`S-05` / `S-07` / `S-08` parallel)                  | The market-feedback spine. North star `S-01` leads; feedback, error-monitoring, and deletion all hang off the F-01 contract.                                                               |
| B      | Launch-safety gates         | `F-02` → (`S-02` / `S-03` / `S-06` parallel) → `S-04`; `S-03` → `S-09` | The signup→app gating work that makes the funnel safe to expose; `S-04` (Google) joins after `S-02`. `S-09` (legal pages + consent record) finishes the S-03 scope after the gate shipped. |

(Every `F-NN` and `S-NN` appears in exactly one stream. The two streams are independent after their foundations — a capacity-constrained solo builder can alternate between them or fan agents across both.)

## Baseline

What's already in place in the codebase as of `2026-06-11` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands; questionnaire (`src/pages/cv/new.astro` → `QuestionnaireFlow.tsx`), one CV template, section editor, client-side PDF export (`useCvExport.ts`).
- **Backend / API:** present — Astro API routes; generation at `src/pages/api/cv/generate.ts`.
- **Data:** present — Supabase Postgres; `public.cvs` (JSONB draft + snapshot, RLS owner-only). `public.subscriptions` + `entitlements.ts` exist and are wired (dormant, no billing behavior). **Absent:** consent, funnel-event, feedback, and daily-usage stores.
- **Auth:** partial — Supabase SSR email/password + middleware route guard. Email verification **scaffolded but NOT enforced** (`confirm-email.astro` page, no gate, no resend). Google/OAuth **absent**. Account-linking **absent**.
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`) + GitHub Actions `ci.yml` / `deploy.yml` (auto-deploy on master). Legal pages **absent**.
- **Observability:** absent — no error monitor, no product analytics/event tracking, no feedback capture; only ad-hoc `console.warn`.

> Note for planning: the generation endpoint today has only a 40 KB request-size cap — no per-user daily limit and no cross-account guard (the gap S-06 closes).

## Foundations

### F-01: Observability baseline

- **Outcome:** (foundation) a managed analytics sink and a managed error monitor are provisioned, and a shared recording contract — pseudonymous user/session identifier, coarse metadata only, **no raw answers/prompts/draft/CV content**, sensitive fields scrubbed before send — is in place and reusable.
- **Change ID:** observability-baseline
- **PRD refs:** FR-008, FR-009, FR-010 (the shared pipeline they all use); NFR "Observability"; NFR "Privacy / data minimization".
- **Unlocks:** S-01 (north-star funnel events), S-05 (feedback storage), S-07 (4-surface error coverage), S-08 (must purge identifying analytics data).
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:**
  - Which specific managed analytics tool + error monitor (PRD Non-Goal mandates managed, not built; tool choice deferred to stack-assessment). The contract can be designed tool-agnostically, so this does not block planning. — Owner: user. Block: no.
  - Whether the GDPR posture + chosen analytics tool require a cookie/consent banner or cookieless pseudonymous tracking suffices (PRD Open Q3). — Owner: user. Block: no.
- **Risk:** Sequenced first because the north star and three other slices all depend on the recording contract; the load-bearing risk is letting raw content leak into a third-party store — the scrub/pseudonymity contract must be established here, once, not per-slice. Kept minimal (provision + contract only) so it does not become a "build the whole observability layer" project.
- **Status:** done

### F-02: Core-flow regression net

- **Outcome:** (foundation) the existing questionnaire → generation → section-editing → save → PDF-export path, existing-CV openability, and PDF output quality are guarded by regression tests, so the new signup→app gates cannot silently break the working flow.
- **Change ID:** core-flow-regression-net
- **PRD refs:** FR-013; Guardrails "the existing flow keeps working unchanged"; NFR "Export reliability & quality".
- **Unlocks:** S-02, S-03, S-06 (gates that sit on the signup→app path and could regress the core flow), S-04 (alters the auth path).
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The new gates all sit on the path to the working app, so "unchanged" is optimistic without a safety net; this foundation makes the guardrail verifiable before any gate lands. Scoped to characterization/regression coverage of the existing path only — not a general test-suite rewrite — so it stays a minimal enabler. Test infra (Vitest + Playwright) already exists, so this is ready now.
- **Status:** done

## Slices

### S-01: Funnel-event instrumentation (north star)

- **Outcome:** (operator) a real user moving landing → registration → email confirmation → questionnaire started → questionnaire completed → CV generated → CV saved → PDF exported is recorded as 8 distinct tracked events, so step-to-step conversion and drop-off are visible.
- **Change ID:** funnel-event-instrumentation
- **PRD refs:** FR-008, US-01; Success Criteria Primary + Secondary (step-to-step drop-off).
- **Prerequisites:** F-01
- **Parallel with:** S-05, S-07, S-08 (all share only the F-01 prerequisite)
- **Blockers:** —
- **Unknowns:**
  - Coarse-metadata field set per event that stays pseudonymous and content-free. — Owner: user/team. Block: no.
- **Risk:** This is the validation milestone — sequenced as early as F-01 allows. The risk is instrumenting unevenly (missing one funnel step makes the drop-off picture lie); the 8 events must be wired as one coherent slice across the existing flow, not drip-fed.
- **Status:** done

### S-02: Enforce email verification

- **Outcome:** a new unverified user is held at a verify/resend state (only landing, sign-in/sign-up, legal, contact reachable), can resend the verification email (abuse-protected), and after verifying is sent to the login page; existing pre-launch accounts are grandfathered (treated as verified) with no forced re-auth.
- **Change ID:** enforce-email-verification
- **PRD refs:** FR-001, FR-002, FR-014, US-01; Access Control "Change 1".
- **Prerequisites:** F-02
- **Parallel with:** S-03, S-06 (share the F-02 prerequisite, no path between them)
- **Blockers:** —
- **Unknowns:**
  - Exact grandfathering mechanism — one-time data migration vs. gating exception — without forcing re-authentication (PRD Open Q6). — Owner: user. Block: no.
  - Whether built-in Supabase email sending is reliable at launch volume or a transactional email provider is needed (PRD Open Q4). — Owner: user (resolve in stack-assessment). Block: no.
- **Risk:** A hard wall can suppress the very funnel completion we want to measure; mitigated (not removed) by mandatory resend + inbox/spam guidance. Must not lock out existing accounts — grandfathering is the load-bearing compatibility constraint, so this depends on F-02's regression net.
- **Status:** done

### S-03: Consent-gated registration (consent gate)

- **Outcome:** registration cannot complete without accepting the combined Privacy + Terms consent, enforced on both client (inline-validated checkbox) and server (request rejected before account creation), localized across en/pl/ru.
- **Change ID:** consent-gated-registration
- **PRD refs:** FR-005, FR-006, FR-007, US-01.
- **Prerequisites:** F-02
- **Parallel with:** S-02, S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sits on the registration path, so it depends on F-02. Deliberately split from the legal-page content and the consent audit record (now S-09) so the gate mechanics could land independently of the data-flow audit and final policy copy.
- **Delivered:** combined required consent checkbox + client/server enforcement + `consent_required` error and consent copy across en/pl/ru. The `/terms` and `/privacy` links are placeholders pending S-09.
- **Descoped to S-09:** real Privacy Policy + Terms of Service page content, and the accepted-policy-version + acceptance-timestamp record (NFR "Consent auditability").
- **Status:** done (gate)

### S-04: Google sign-in + account linking

- **Outcome:** a user can sign up / sign in with Google alongside email/password; a Google sign-in whose verified email matches an existing account resolves to that one profile (no duplicate) and satisfies the verification requirement without a separate step.
- **Change ID:** google-signin-linking
- **PRD refs:** FR-003, FR-004, US-02; Access Control "Change 2".
- **Prerequisites:** S-02
- **Parallel with:** S-05, S-06, S-07, S-08 (independent once the verification model from S-02 exists)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Auto-linking by email could risk an unintended merge / takeover; constrained to verified-on-both-sides only (Google emails are provider-verified). Depends on S-02 because "Google email counts as verified" only means something once the verification model exists.
- **Delivered:** "Continue with Google" on `/auth/signin` + `/auth/signup` (signup consent-gated, client + server); server-side OAuth start endpoint with a signed short-lived consent cookie; `/auth/callback` that exchanges the code, branches new-vs-returning (Supabase auto-links by verified email — no duplicate), stamps consent + emits `funnel_signup_completed{method:"google"}` for new accounts only, and maps failures to localized `?error=` banners; en/pl/ru copy. Unit coverage for start/callback/consent-cookie/i18n + Playwright E2E for button render, consent gate, and provider-redirect initiation (provider hop mocked). The real Google round-trip is manual-only.
- **Status:** done

### S-05: Post-generation feedback

- **Outcome:** after a CV is generated, a user can mark the result Helpful or Not Helpful and add an optional text comment; feedback is stored against the generation event identifier only — no CV/answer content stored alongside.
- **Change ID:** post-generation-feedback
- **PRD refs:** FR-010, US-01.
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low risk; the only trap is re-exposing CV content by linking feedback to the draft — store against the generation event id only, reusing F-01's no-raw-content contract.
- **Delivered:** a content-free `generationEventId` minted per generation in `POST /api/cv/generate`, returned to the client and attached to `funnel_cv_generated`; `public.feedback` (owner-only RLS, `unique (user_id, generation_event_id)`, **no FK to `public.cvs`**, cascade from `auth.users`) behind a fail-soft `POST /api/cv/feedback` that upserts a verdict + optional ≤1000-char comment; a Helpful / Not-helpful widget with an optional comment rendered inline under the generated draft, en/pl/ru, keyed on the generation id so regeneration resets it and scoped away from the reopen-saved-CV flow. The `feedback_submitted` analytics event carries only `helpful` / `locale` / `generation_event_id` — the comment never leaves the database. Unit + contract coverage for the schema, route, repository, scrub allowlist and copy; Playwright E2E for submit, no-comment submit, and the fail-soft retry path.
- **Status:** done

### S-06: Daily generation limit + aggregate abuse guard

- **Outcome:** a user is limited to 100 CV generations per day with a clear message when reached, and a coarse aggregate/cross-account guard caps abnormal volume; the limit is authoritative server-side and cannot be bypassed from the user's device.
- **Change ID:** daily-generation-limit
- **PRD refs:** FR-012; Guardrails "the daily limit never blocks a legitimate user under normal use"; NFR "Generation availability".
- **Prerequisites:** F-02
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:**
  - ~~Concrete aggregate/cross-account ceiling and any single-origin signup throttle numbers (PRD Open Q5).~~ Resolved: **500 successful generations per rolling hour** product-wide. The signup throttle stays deferred — this slice covers the generation ceiling only.
- **Risk:** This is abuse protection, not a paywall — the load-bearing constraint is that it never blocks a legitimate user under normal use; the per-user cap is straightforward, the aggregate guard's thresholds need real numbers. Touches the generation path, so it depends on F-02. Must not be built on the dormant billing scaffolding.
- **Delivered:** an append-only `public.generation_usage` ledger (RLS on, **no policies at all**) plus two `security definer` functions — `check_generation_quota` (per-user UTC-day cap, then product-wide rolling-hour ceiling) and `record_generation`, which re-checks the cap on write so the ledger is self-bounding and cannot be turned into a DoS vector by a direct PostgREST call. `POST /api/cv/generate` is now check → generate → record: the check sits after zod validation but **before** the provider-key check, so a refused user costs no LLM spend. `user_daily` → 429 with a new `daily_limit_reached` bucket (number-free copy in en/pl/ru, since both limits are env-tunable); `global_hourly` → 503 reusing `service_unavailable`, deliberately indistinguishable from an ordinary outage. **Fails open in both directions** — a counter outage still generates, and a failed ledger write still returns the draft. Limits tunable via `GENERATION_DAILY_LIMIT` / `GENERATION_HOURLY_CEILING` (defaults 100 / 500 in code). `generation_limit_reached` carries only `limit_kind` + `locale`. Zero client changes — the questionnaire already localizes arbitrary buckets. Unit + route-contract coverage for every branch incl. both fail-open postures; Playwright E2E drives the real, unmocked wall under its own config (`playwright.quota.config.ts`, port 4322, `GENERATION_DAILY_LIMIT=0`).
- **Not covered:** the counting arithmetic is proven by SQL-level checks and route contract tests, not end-to-end — driving a real 100-generation count through a browser would cost 100 OpenAI calls. The 500/hour ceiling is an educated guess, unvalidated against real traffic; `generation_limit_reached` exists so it can be revisited.
- **Status:** done

### S-07: Centralized error monitoring

- **Outcome:** (operator) failures across all four surfaces — frontend, backend/API, AI generation, PDF export — are reported to the centralized monitor within a short window, with request bodies, prompts, answers, and draft/CV content scrubbed before any report leaves the product.
- **Change ID:** centralized-error-monitoring
- **PRD refs:** FR-009; NFR "Observability"; NFR "Privacy / data minimization".
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-05, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Error payloads are the easiest place to leak raw answers/draft content to a third-party monitor; mandatory field scrubbing (reusing F-01's contract) is the load-bearing requirement — report only error type, location, and non-sensitive metadata.
- **Delivered:** a closed typed `ErrorLocation` union (`src/lib/observability/locations.ts`) so a mistyped location is a compile error rather than a silently split PostHog bucket; a `waitUntil`-else-detached emit scheduler so broadening from 1 to ~18 report sites puts no PostHog round-trip on any response. **Backend:** a middleware catch-all around `next()` that reports and re-throws the _original_ value (so Astro's error handling is unperturbed) and sends `routePattern`, never `pathname` — keeping CV ids out of the monitor; plus explicit reports at all six previously-bare `catch {}` blocks in the CV routes, and the two pre-F-01 `console.warn` breadcrumbs promoted to real reports. **AI:** `cv-generation.ts` now distinguishes its **seven** failure modes via an injected reporter (kept injected so the service stays dependency-free), with the provider's HTTP status attached on the non-ok path — "OpenAI is down" is finally distinguishable from "the model returned unparseable output". **Client:** PDF export reports with a location derived from the same verdict as the user-facing copy; the save / delete / generate fetches report **transport failures only**, since every non-ok response is already reported server-side. Emission is deduped client-side on `error_type` + `error_location` within 10s. **Added in `/10x-impl-review`:** the plan had surveyed `src/pages/api/**` only and missed that `dashboard.astro` and `cv/[id].astro` call the repository directly — the paths users actually hit, since both views are server-rendered — so those two now report too (`pages/dashboard:listCvs`, `pages/cv/[id]:getCv`), with a `z.uuid()` guard on the reopen page so a malformed id stays an unreported user-input redirect. 24 report sites total. Every user-facing response, status code, and error bucket is unchanged — this slice adds observation only. 38 new unit/contract tests (285 total), incl. a privacy assertion per surface.
- **Not covered:** React island render crashes (declined — `window.onerror` does not catch them, so a crashed island still blanks silently) and feedback-submit failures (declined; fail-soft by design). `lib/supabase:safeGetUser` reports from route call sites but not from middleware, which runs before the observability identity is resolved. Validation, auth, 404, and quota refusals are deliberately unreported under the "ours, not theirs" rule — a validation schema that is wrong for real users will read as silence, not a spike.
- **Status:** done

### S-08: Permanent account deletion

- **Outcome:** a user can permanently delete their account via an explicit, deliberate confirmation step, which removes their profile, CVs, questionnaire answers, sign-in identity, and associated personal data (including identifying analytics data) with no recoverable copy retained.
- **Change ID:** account-deletion
- **PRD refs:** FR-011, US-03; Access Control "New self-service"; NFR "Right to erasure".
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-05, S-07
- **Blockers:** —
- **Unknowns:**
  - ~~Privileged deletion path that also removes the Supabase sign-in identity (not only CV data), leaving no recoverable copy across any controlled store.~~ **Answered by S-08 (2026-08-09):** the Supabase **admin API** (`auth.admin.deleteUser`) behind a dedicated rotatable `SUPABASE_SECRET_KEY`, isolated to one module by an ESLint fence — chosen over a `security definer` function so the `auth.users` row itself is removed, which is what makes the cascade total.
- **Risk:** Immediate permanent deletion is irreversible and must purge the sign-in identity + identifying analytics PII — a delayed/recoverable delete was rejected because holding "deleted" data complicates the privacy promise. Depends on F-01 because erasure must cover the analytics identifier model established there.
- **Delivered:** `POST /api/account/delete` — identity read from the verified session only (**no user-id field exists in the request schema**), an email-match confirmation gate, then `auth.admin.deleteUser`, after which the four `on delete cascade` foreign keys remove CVs + questionnaire snapshots, feedback, the subscription row, and the generation ledger; the consent stamp goes with the `auth.users` metadata. Post-commit teardown (`signOut`, `obs_session` / `obs_confirmed` cookie clearing) is best-effort and swallowed — the data is already gone, so an error screen would tell the user the opposite of the truth. `ui_locale` deliberately survives. A protected `/account` page carries the danger zone; the confirmation island reuses `ConfirmDialog` and the **same** `confirmationMatches` module as the server, so client and server gates cannot diverge. Missing key ⇒ 503 + an honest "unavailable" state, never a button guaranteed to fail. Trilingual (en/pl/ru), `/?deleted=1` notice on the landing page. Coverage: route contract tests for all five status codes, a schema test proving identity cannot be client-supplied, a **pgTAP** cascade test (`npm run test:db`, R-14) that also inventories every `public` foreign key into `auth.users` so a future table without a cascade fails loudly, and a **non-destructive** Playwright gate spec (R-15) that never confirms. Privacy policy gained the deletion section + the analytics-erasure argument (`POLICY_VERSION` bumped).
- **Analytics erasure:** no PostHog delete call, by reasoning rather than omission — every capture sets `$process_person_profile: false`, so no person object exists, and the signed-in `distinct_id` is `HMAC-SHA256(salt, user.id)`. Deleting `auth.users` destroys `user.id`, the sole input that could regenerate that pseudonym, leaving residual events unlinkable.
- **Deployment prerequisite:** `SUPABASE_SECRET_KEY` must be set as a Cloudflare Worker secret before this ships. Unset is the kill switch — but an unavailable erasure surface is itself a compliance problem, so treat it as a release blocker, not an optional extra.
- **Status:** done

### S-09: Legal pages + consent record

- **Outcome:** a visitor can open a real Privacy Policy page (discloses AI-assisted generation) and a Terms of Service page at `/terms` and `/privacy` (the placeholder links shipped by S-03 now resolve to content), and every registration records the accepted policy version + acceptance timestamp per user, giving an auditable proof-of-consent.
- **Change ID:** legal-pages-and-consent-record
- **PRD refs:** FR-005, FR-006, FR-007; NFR "Consent auditability".
- **Prerequisites:** S-03 (the consent gate that the pages link from and that this record stamps — already shipped).
- **Parallel with:** S-04, S-06 (independent once the gate from S-03 exists).
- **Blockers:** —
- **Unknowns:**
  - Privacy Policy _content_ must be grounded in a real data-flow audit, not a template (PRD Open Q1). Only the Privacy Policy wording waits on the audit; the pages' scaffolding, the ToS draft, and the version/timestamp record are plannable now. — Owner: user. Block: partial (Privacy Policy copy only).
  - ToS to be legal-reviewed before scaling marketing (PRD Open Q2). — Owner: user / legal reviewer. Block: no.
  - Where the consent record lives — Supabase user metadata vs. a dedicated consent table — plus the policy-version constant the gate stamps. — Owner: user/team. Block: no.
- **Risk:** The enforcing gate already shipped (S-03), so the load-bearing risk here is the Privacy Policy text being written from a template rather than the real data flows — split so the version/timestamp record and the ToS draft land independently of the audited Privacy copy. Recording consent introduces a per-user data write, so it must reuse the owner-only RLS + data-minimization posture established in F-01.
- **Delivered:** consent stamp (`POLICY_VERSION` + acceptance timestamp written to `user_metadata` at signup); real `/terms` + `/privacy` pages (English bodies, localized chrome across en/pl/ru) behind a shared `LegalDocument`; a global `Footer` linking both pages site-wide; Playwright E2E for page resolution + link navigation. Legal bodies remain drafts pending the data-flow audit (Open Q1) and legal review (Open Q2).
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                                              | Ready for `/10x-plan` | Notes                                                                                                          |
| ---------- | ------------------------------ | ---------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| F-01       | observability-baseline         | Provision managed analytics + error monitor with no-raw-content recording contract | yes                   | Unblocks the north star S-01 + S-05/S-07/S-08                                                                  |
| F-02       | core-flow-regression-net       | Add regression net around questionnaire→generate→save→export                       | yes                   | Guards the existing flow before gates land                                                                     |
| S-01       | funnel-event-instrumentation   | Instrument the 8 funnel events across the existing flow                            | no                    | Run after F-01                                                                                                 |
| S-02       | enforce-email-verification     | Enforce email verification hard wall + resend + grandfathering                     | no                    | Run after F-02                                                                                                 |
| S-03       | consent-gated-registration     | Consent-gated registration (client + server gate)                                  | yes                   | Gate shipped; pages + consent record split to S-09                                                             |
| S-04       | google-signin-linking          | Add Google sign-in with verified-email account linking                             | no                    | Run after S-02                                                                                                 |
| S-05       | post-generation-feedback       | Add Helpful/Not-Helpful feedback after generation                                  | no                    | Run after F-01                                                                                                 |
| S-06       | daily-generation-limit         | Enforce 100/day limit + cross-account abuse guard                                  | no                    | Shipped 2026-08-07; thresholds set at 100/day + 500/hour                                                       |
| S-07       | centralized-error-monitoring   | Wire error monitoring across all 4 surfaces with scrubbing                         | no                    | Shipped 2026-08-08; transport-only on the client to avoid double-counting                                      |
| S-08       | account-deletion               | Self-service permanent account + data deletion                                     | no                    | Shipped 2026-08-09; admin-API deletion behind `SUPABASE_SECRET_KEY` — set it as a Worker secret before release |
| S-09       | legal-pages-and-consent-record | Author Privacy + Terms pages and record accepted version + timestamp               | no                    | Run after S-03; Privacy copy waits on data-flow audit (Open Q1)                                                |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. One row per `F-NN` and `S-NN`.

## Open Roadmap Questions

1. **Privacy/data-flow audit (FR-005)** — enumerate the real data flows (auth, CV/answer storage, AI processing, chosen analytics store, chosen error monitor, feedback) before writing the Privacy Policy. — Owner: user. Block: S-09 (Privacy Policy content only — partial).
2. **Terms of Service legal review (FR-006)** — ship a lean draft, review before scaling marketing. — Owner: user / legal reviewer. Block: none (by: before public marketing push).
3. **Analytics consent under GDPR (FR-008)** — confirm whether the chosen analytics tool + GDPR posture require a cookie/consent banner, or whether cookieless pseudonymous tracking avoids it. — Owner: user. Block: F-01 / S-09 (compliance surface — no hard block).
4. **Verification email deliverability (FR-001/FR-002)** — confirm whether built-in email sending suffices at launch volume or a dedicated transactional email capability is needed. — Owner: user (resolve in stack-assessment). Block: S-02 (no hard block).
5. ~~**Aggregate abuse-guard thresholds (FR-012)**~~ — **Answered by S-06 (2026-08-07):** 100 generations per user per UTC day, 500 product-wide per rolling hour, both env-tunable. Unvalidated against real traffic — revisit once `generation_limit_reached` has data. The single-origin signup throttle was explicitly descoped and remains unanswered; re-open it if signup abuse appears.
6. **Grandfathering mechanism (FR-014)** — decide exactly how pre-launch accounts are marked verified without forcing re-authentication. — Owner: user. Block: S-02 (no hard block).
7. **Specific managed analytics + error-monitor tools** — the PRD fixes "managed, not built" but defers the tool choice to stack-assessment; F-01's contract is tool-agnostic, so this does not block planning. — Owner: user. Block: F-01 (no hard block).

## Parked

- **Monetization of any kind** — Why parked: PRD §Non-Goals — no subscriptions, billing, paywalls, or premium AI tiers; validating the funnel comes first. Dormant billing scaffolding stays inert.
- **Premium / presentation features (ATS enhancements, multiple templates, photo support, dark mode)** — Why parked: PRD §Non-Goals — deferred until the funnel is validated.
- **Formal roles / RBAC** — Why parked: PRD §Non-Goals — a single fixed operator identity only; no role system.
- **Custom analytics / monitoring infrastructure built from scratch** — Why parked: PRD §Non-Goals — managed third-party tooling is used instead.
- **Wave B: internal admin metrics dashboard + contact/support page** — Why parked: PRD §Non-Goals (sequencing, not exclusion) — deferred to a later wave; the data the dashboard reads is produced by this release. May be pulled forward if Wave A lands early.

## Done

- **S-08: a user can permanently delete their account via an explicit type-your-email confirmation, removing their sign-in identity, CVs, questionnaire answers, feedback, subscription row, generation ledger, and consent record with no recoverable copy retained.** — Shipped 2026-08-09 on branch `account-deletion` (p1–p3 + epilogue: `8d1294d`, `998ae47`, `a9ba8f5`, `15b810f`); all three phases automated- and manually-verified, `/10x-archive` pending. Lesson: the browser test written to guard the confirmation gate found a defect nothing else could see — `ConfirmDialog` captured `document.activeElement` in a passive effect, which runs _after_ React applies `autoFocus`, so it recorded the dialog's own Cancel button as "where focus came from" and restored focus to a node about to be detached. Focus silently fell to `<body>` on every close, at all three call sites, for as long as the component had existed. Type checks, unit tests, and lint were all green throughout: when a component's contract is about focus, only something driving a real browser can hold it to that contract. Second lesson: this slice's central claim — that deleting one row erases everything — lived entirely in schema DDL that no application code re-reads, so no unit or E2E test could observe its loss. A pgTAP test that both exercises the cascade _and_ inventories the foreign keys pointing at `auth.users` is what makes a future table added without `on delete cascade` fail loudly instead of silently orphaning a "deleted" user's data.
- **S-07: (operator) failures across all four surfaces — frontend, backend/API, AI generation, PDF export — are reported to the centralized monitor, with request bodies, prompts, answers, and draft/CV content structurally incapable of leaving the product.** — Shipped 2026-08-08 on branch `centralized-error-monitoring` (p1–p4: `12a0ee2`, `6ab0a13`, `85cd240`, + p4); all four phases automated- and manually-verified, `/10x-archive` pending. Lesson: the plan said the client should report transport failures _and_ non-ok responses — but phases 2 and 3 had already put a precise server-side report on every one of those responses, so following the plan literally would have double-counted the most common failures and made the rates unusable. Coverage plans written per-surface should state, per site, _who already reports it_; "add reporting here" is not the same question as "is this failure currently invisible". Second lesson, from the review: the plan's survey grepped `src/pages/api/**` and concluded "9 of 10 routes silent" — but in an SSR framework the pages themselves call the data layer directly, and those are the hot paths. Surveying by directory rather than by data-access call site missed the two most-trafficked loads in the app.
- **S-01: (operator) a real user moving landing → registration → email confirmation → questionnaire started → questionnaire completed → CV generated → CV saved → PDF exported is recorded as 8 distinct tracked events, so step-to-step conversion and drop-off are visible.** — Archived 2026-06-15 → `context/archive/2026-06-12-funnel-event-instrumentation/`. Lesson: —.
- **S-09: a visitor can open real Privacy + Terms pages at `/terms` and `/privacy` (the S-03 placeholder links now resolve), reach them from a site-wide footer, and every registration records the accepted policy version + acceptance timestamp for an auditable proof-of-consent.** — Shipped 2026-06-19 on branch `legal-pages-and-consent-record`; archival pending `/10x-archive`. Lesson: —.
- **S-04: a user can sign up / sign in with Google alongside email/password; a Google sign-in whose verified email matches an existing account resolves to that one profile (no duplicate) and satisfies verification without a separate step.** — Automated work shipped 2026-06-22 on branch `google-signin-linking` (p1–p5: `2787f45`, `b177e20`, `e3b02cc`, `e9d93a4`, `4da4fff`); real-Google manual verification + `/10x-archive` pending. Lesson: —.
- **S-06: a user is limited to 100 CV generations per UTC day with a clear localized message when the wall is reached, a product-wide 500/hour ceiling caps cross-account abuse, and the limit is server-authoritative — decided in Postgres, unbypassable from the device.** — Shipped 2026-08-07 on branch `daily-generation-limit` (p1–p3 + epilogue: `050e479`, `518b1e2`, `15374bf`, `de2ea2c`); all three phases automated- and manually-verified, `/10x-archive` pending. Lesson: the planned "second `webServer` entry" for the quota-limited E2E server was built and rejected on evidence — two Astro dev servers booting concurrently starved each other enough on a cold Vite cache that an unrelated spec (`legal-pages`) blew its 30 s timeout, reproducibly, while the pre-change baseline stayed green. Separate Playwright configs run sequentially and cost nothing. When a plan calls for a second long-running server inside one test run, budget a baseline comparison before trusting the green.
- **S-05: after a CV is generated, a user can mark the result Helpful or Not Helpful and add an optional text comment; feedback is stored against the generation event identifier only — no CV/answer content stored alongside.** — Shipped 2026-07-31 on branch `post-generation-feedback` (p1–p4 + epilogue: `97a056e`, `4912334`, `1fbb1d9`, `185d296`, `566dc9c`); all four phases automated- and manually-verified, `/10x-archive` pending. Lesson: the E2E harness carried two latent breaks that only surfaced when a new spec ran it — an ambiguous consent-checkbox locator left behind by S-04 and a fixture UUID the server schema rejects; adding a spec to an unexercised suite is worth budgeting repair time for.
