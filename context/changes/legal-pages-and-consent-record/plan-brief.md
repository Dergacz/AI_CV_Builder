# Legal Pages + Consent Record — Plan Brief

> Full plan: `context/changes/legal-pages-and-consent-record/plan.md`

## What & Why

Roadmap slice **S-09** finishes the scope split off from the shipped consent gate (S-03). The signup checkbox already links to `/terms` and `/privacy`, but those pages don't exist and registrations leave no audit trail. This plan makes the links resolve to real (draft) legal content, records each user's accepted policy version + acceptance timestamp, and adds a global footer so the pages are discoverable site-wide.

## Starting Point

The consent **gate** is live: a combined required checkbox, client + server enforcement, a `consent_required` error, and en/pl/ru consent copy — all shipped in `consent-gated-registration`. But `ConsentCheckbox.tsx:38,42` links to non-existent `/terms` and `/privacy` (both 404), `signup.ts:21` records nothing about consent, and `Layout.astro` has no footer.

## Desired End State

`/terms` and `/privacy` render real English-bodied drafts (version + "pending legal review" notice, localized chrome), reachable from both the signup links and a new site-wide footer. Every new registration writes `consent_version` + `consent_accepted_at` into Supabase `user_metadata`, stamped atomically by the `signUp` call — verifiable in Supabase Studio.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Consent record storage | `user_metadata` via `signUp` `options.data` | Atomic at signup, no session/RLS/migration needed — works in prod's no-session confirm path where a table insert would fail | Plan |
| Policy versioning | Single date-based `POLICY_VERSION` constant | One source of truth matching the combined single-checkbox consent; trivial to bump | Plan |
| Legal-body localization | English-only, kept out of the typed i18n bundle | Avoids forcing binding legal translations; the typed bundle enforces all 3 locales | Plan |
| Privacy copy under the audit block | Grounded draft from the code's real data flows, flagged for review | Page goes live with honest disclosure instead of a stub; formal audit/legal review still pending | Plan |
| Discoverability | Global footer with legal links | User chose site-wide discoverability over consent-links-only | Plan |
| ToS depth | Lean draft, essential clauses | Matches roadmap's "lean draft before scaling marketing" | Plan |
| Testing | Unit (stamp) + light E2E (pages resolve, links navigate) | Covers the one behavioral change + the user-visible contract without pinning tests to draft wording | Plan |

## Scope

**In scope:** `POLICY_VERSION` constant; consent metadata stamp on signup + unit test; `/terms` + `/privacy` pages (English bodies, localized chrome) behind a shared `LegalDocument` component; global `Footer` wired into `Layout`; light Playwright E2E.

**Out of scope:** changing the consent gate; pl/ru legal-body translations; dedicated consent table / service-role client / migration; re-consent flows on version bump; finalized legal copy; tamper-proof audit (user_metadata is editable later); legal-wording test assertions.

## Architecture / Approach

A `src/lib/legal/policy.ts` constant feeds both the signup stamp and the pages. The stamp rides on the existing `signUp` call (`options.data`) — no new persistence. Pages follow the standard `getMessages(locale)` → `Layout` pattern; bodies are inline English Astro markup (out of the typed bundle), chrome strings are a new localized `legal` section. A `Footer.astro` (localized `footer` copy) renders in `Layout.astro` on every page.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Consent record stamp | `POLICY_VERSION` + `signUp` metadata stamp + unit test | Stamp must ride on `signUp` (no session in prod for a follow-up write) |
| 2. Legal pages + chrome | `/terms` + `/privacy` resolve; shared `LegalDocument`; localized `legal` chrome | Keeping legal bodies out of the typed bundle; Privacy copy honesty |
| 3. Global footer + E2E | Site-wide footer links; Playwright E2E | New shared component touches every page |

**Prerequisites:** S-03 consent gate (shipped). Local Supabase for manual checks + E2E (`npm run db:start`).
**Estimated effort:** ~1–2 sessions across 3 phases; content authoring (the two drafts) is the main time sink.

## Open Risks & Assumptions

- Privacy/Terms copy is an explicit **draft pending the formal data-flow audit (Open Q1) and legal review (Open Q2)** — engineering is done when the pages render correct, honest, version-stamped content; the wording is expected to change.
- `user_metadata` is a faithful stamp at signup but technically user-editable later; the tamper-proof table/app_metadata path was deliberately deferred.
- Production must keep `enable_confirmations = true`; the stamp is designed to work whether or not a session is issued.

## Success Criteria (Summary)

- A new registration records `consent_version` + `consent_accepted_at` (visible in Supabase Studio).
- `/terms` and `/privacy` render real draft content reachable from the consent links and the global footer.
- `typecheck` + `lint` + unit tests + build + light E2E all green.
