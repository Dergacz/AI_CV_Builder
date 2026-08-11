# Funnel-Event Instrumentation (S-01) — Plan Brief

> Full plan: `context/changes/funnel-event-instrumentation/plan.md`

## What & Why

Roadmap slice **S-01 (north star)**: instrument the 8 funnel steps — landing → registration → email confirmation → questionnaire started → questionnaire completed → CV generated → CV saved → PDF exported — so step-to-step conversion and drop-off become *visible*. This is the validation milestone: the funnel already works mechanically, but nothing proves it converts. We wire the events onto F-01's already-built recording contract; the riskiest thing is instrumenting *unevenly* (one missed or mis-keyed step makes the drop-off picture lie).

## Starting Point

F-01 built and proved the contract — PostHog EU transport, `track()`/`trackClient()`, allowlist scrubber, pseudonymous identity — but it has **zero production callers** outside the guarded smoke route. The event-name unions are closed (`observability_smoke | observability_error`), the scrubber allows 9 keys, and the identity helpers (`getPseudonymousUserId`, `getAnonSessionId`) are called only from the smoke endpoint. The client SDK is initialized cookieless (`persistence:"memory"`, `$process_person_profile:false`) in `Layout.astro`.

## Desired End State

A real user's journey produces 8 distinct, content-free events in PostHog, read as **two linked funnel segments**: an anonymous segment (`landing_viewed`→`signup_completed`, keyed by the anon-session id) and an identified segment (`email_confirmed`→`pdf_exported`, keyed by the pseudonymous user id). Within each segment, server- and client-emitted events share one distinct_id, so the steps connect. The cookieless / no-person-profile privacy posture is preserved; no raw content or raw user id leaves.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Anon↔identified stitching | Two linked funnels, no `identify` | Preserves F-01's cookieless/no-person-profile posture; avoids early consent surface | Plan |
| Emit placement | Server where observable, client only when unavoidable | Server path is ad-block-proof and the F-01 primary; only 4 steps lack a server signal | Plan |
| Event schema | 8 distinct event names | PostHog funnels are name-based; closed union makes typos compile-errors | Plan |
| Email-confirm detection | First authenticated session where `email_confirmed_at` set, once-only | No API hook exists; anchors to real auth state and survives dev auto-confirm | Plan |
| Repeat emissions | Emit every occurrence; PostHog dedupes | Stateless; funnel math already takes first-touch per distinct_id | Plan |
| Failure events | Success steps only | Drop-off = absence of next step; errors are S-07's job | Plan |
| Per-event metadata | Minimal reused allowlisted keys | Zero scrubber changes, nothing new to privacy-review | Plan |
| Testing | Unit-test the seams, manual funnel verify | Covers silent-break logic without flaky beacon-intercept E2E | Plan |

## Scope

**In scope:** 8 funnel event names (server + client unions); request identity resolved once in middleware and bootstrapped into the client SDK; 4 server emits + 4 client emits; once-only `email_confirmed`; unit tests for the seams; manual two-funnel verification.

**Out of scope:** PostHog `identify`/person profiles; failure/abandon events; new allowlist keys; per-step dedup; E2E funnel assertions; consent banner (S-03); dashboards.

## Architecture / Approach

Middleware resolves **one distinct_id per request** (pseudonymous when authed, anon-session id otherwise) and caches it on `locals`; `Layout.astro` threads that id onto a DOM data attribute so the client init can bootstrap posthog-js with the *same* id (`bootstrap.distinctID`, person profiles still off). Server steps emit from their API success branches; client steps emit via `trackClient`. The id flips from anon to pseudonymous at exactly the signup boundary — which is why the anonymous and identified funnels are linked but not stitched. Every emit is fire-and-forget and carries only already-allowlisted coarse metadata.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Foundation: vocabulary + identity | 8 event names; per-request distinct_id in middleware; client bootstrap threading | Client/server distinct_id mismatch → identified funnel won't connect |
| 2. Server emits (4) | `signup_completed`, once-only `email_confirmed`, `cv_generated`, `cv_saved` | Email-confirm firing zero or every-session; emitting on error branch |
| 3. Client emits (4) + verification | `landing_viewed`, `questionnaire_started/completed`, `pdf_exported`; two-funnel check | A step wired to the wrong moment skews the funnel |

**Prerequisites:** F-01 (done). A PostHog EU project with keys configured locally to run the manual funnel verification.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes posthog-js `bootstrap.distinctID` pins the client id without enabling person profiles; verify in Phase 1 manual check.
- `email_confirmed` once-guard correctness (fires once, not zero, not per-session) is the trickiest logic — unit-tested.
- Two unstitched funnels mean cross-boundary single-person tracking isn't possible; acceptable for validation, revisit only if a connected funnel is later required.

## Success Criteria (Summary)

- A full walk produces all 8 events in PostHog, content-free.
- The anonymous funnel and the identified funnel each resolve with a single distinct_id per user-session (proving client/server id alignment).
- A repeat sign-in produces no duplicate `email_confirmed`; a failed generation produces no `cv_generated`.
