# Post-Generation Feedback (S-05 / FR-010) — Plan Brief

> Full plan: `context/changes/post-generation-feedback/plan.md`

## What & Why

After a CV is generated, let the user mark it **Helpful / Not Helpful** with an **optional comment**, captured for product improvement (roadmap S-05, FR-010). The feedback is the market-validation signal that hangs off the F-01 observability spine — it tells us whether generations actually land.

## Starting Point

The generate endpoint (`src/pages/api/cv/generate.ts`) returns only a draft — **no identifier of any kind** — and `CvEditor.tsx` renders that draft right after generation. F-01 observability (`src/lib/observability/`) already provides a pseudonymous, content-free `track()` to PostHog behind a strict 10-key allowlist; there is no events table and no feedback store.

## Desired End State

A signed-in user sees a "Was this helpful?" prompt inline with the generated draft. Submitting writes one upsertable row to a new `public.feedback` table keyed by a content-free `generation_event_id` (never by the CV), and emits a content-free `feedback_submitted` analytics event. No draft/answer content is ever stored alongside or sent to PostHog. The core generate→edit→save→export flow is untouched.

## Key Decisions Made

| Decision                       | Choice                                                | Why (1 sentence)                                                                 | Source |
| ------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Feedback↔generation link       | Mint a content-free `generation_event_id`             | Honors the roadmap's "store against the generation event id only" warning; works pre-save. | Plan (Roadmap warning) |
| Storage                        | DB table for rating+comment + content-free PostHog event | Free-text comment can't go to PostHog (allowlist/F-01); both durable record and aggregate signal exist. | Plan |
| Widget placement               | Inline in `CvEditor`, immediately after generation    | Captured at the moment of reaction; works without saving.                        | Plan |
| Resubmit semantics             | Editable upsert, one row per generation               | User can correct a misclick or amend; clean aggregate.                           | Plan |
| Comment rules                  | Optional on both verdicts, capped ~1000 chars         | Matches FR-010 ("optional text comment") and captures positive signal too.       | Plan |
| Account-deletion coupling      | `user_id` FK `ON DELETE CASCADE`                      | S-08 purge for free; RLS owner-only like `cvs`.                                  | Plan |

## Scope

**In scope:** generation event id plumbing; `public.feedback` table + RLS; `POST /api/cv/feedback`; inline Helpful/Not-Helpful + optional comment widget; en/pl/ru copy; content-free analytics event; unit + E2E tests.

**Out of scope:** admin/dashboard to view feedback; feedback on saved-library CVs; rate-limiting/anti-spam; special regeneration re-prompt; storing the id on `public.cvs`; anonymous feedback.

## Architecture / Approach

Back-to-front in four phases. The `generation_event_id` minted in the generate route is the seam: returned to the client for the widget, attached to `funnel_cv_generated` for correlation, and used as the feedback row key. The widget POSTs to a new endpoint that upserts under RLS and emits a content-free event. Comment text lives only in Postgres.

## Phases at a Glance

| Phase                                   | What it delivers                                              | Key risk                                                        |
| --------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 1. Generation id + observability        | Minted id in response + on funnel event; allowlist widened   | Widening the F-01 allowlist must stay content-free             |
| 2. Feedback store + API                 | `public.feedback` table + RLS + fail-soft `POST` endpoint     | Leaking comment text into the analytics event; RLS correctness |
| 3. Feedback widget UI + i18n            | Inline editable widget, en/pl/ru, threaded id                | Widget must scope to fresh generations, not saved-CV reopen    |
| 4. E2E + regression                     | Playwright coverage + core-flow regression confirmation       | Response-shape change must not break the core funnel mocks     |

**Prerequisites:** F-01 observability baseline (done); local Supabase for migration + E2E.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Adding `generation_event_id` / `helpful` to the scrub allowlist is the only sanctioned widening of the F-01 privacy boundary — both are content-free by construction.
- `crypto.randomUUID()` is available in the Cloudflare Workers runtime (standard Web Crypto).
- Shared generate mocks/fixtures (incl. core-flow regression E2E) must be updated to include `generationEventId`.

## Success Criteria (Summary)

- A user can rate a generated CV Helpful/Not-Helpful with an optional comment, and amend it.
- Feedback persists keyed by `generation_event_id` with zero CV/answer content; the analytics event is content-free.
- The existing generate→edit→save→export flow has no regression.
