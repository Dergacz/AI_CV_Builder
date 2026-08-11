# Consent-Gated Registration — Plan Brief

> Full plan: `context/changes/consent-gated-registration/plan.md`

## What & Why

Require new users to affirmatively accept a combined Terms of Service + Privacy Policy consent before they can register. Today signup has no consent step at all; this adds a real, unbypassable gate so accounts are only created for users who have agreed to the terms.

## Starting Point

Registration is a two-layer flow: `SignUpForm.tsx` (React island, validate-on-submit with inline field errors) posts to `src/pages/api/auth/signup.ts`, which calls `supabase.auth.signUp`. Copy is typed and localized across en/pl/ru in `messages.ts`; server errors flow through a typed `authErrorCodes` system. No consent UI, no consent storage, and no `/terms` or `/privacy` pages exist yet.

## Desired End State

The signup form shows a required consent checkbox whose text links to `/terms` and `/privacy`. Submitting unchecked shows an inline error and never POSTs; a direct POST without consent is rejected with `?error=consent_required` before any account is created. The `consent_required` message renders in all three locales.

## Key Decisions Made

| Decision            | Choice                              | Why (1 sentence)                                                            | Source |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------- | ------ |
| Consent scope       | Single combined checkbox            | Simplest clear gate; matches the one-error-per-field form pattern.         | Plan   |
| Persistence         | None — gate only                    | No migration/data model change; ships the gate fast, matches current state.| Plan   |
| Legal links         | Placeholder `/terms` `/privacy`     | Keeps this change focused on the gate; pages are a tracked follow-up.       | Plan   |
| Enforcement         | Client + server (defense in depth)  | Inline UX feedback plus an unbypassable server check — real gate.           | Plan   |
| Checkbox UX         | Inline error like other fields      | Consistent with existing email/password validation; accessible.            | Plan   |
| Testing depth       | Unit (route + form) + i18n type-safety | Covers both enforcement layers at existing test seams; fast.            | Plan   |

## Scope

**In scope:**
- Required consent checkbox in `SignUpForm` with inline Terms/Privacy links and field-level error.
- Server-side rejection of consent-less signups before `signUp`.
- `consent_required` error code + consent copy across en/pl/ru.
- Unit tests for the form and route gates.

**Out of scope:**
- Persisting consent (timestamp/version/table).
- Authoring `/terms` and `/privacy` content.
- Marketing/optional consents; E2E test.

## Architecture / Approach

Bottom-up across three phases: (1) typed i18n copy + `consent_required` error code — compiler enforces all-locale coverage; (2) a new `ConsentCheckbox` component (FormField is text-only) wired into the form's `validate()`/`clearError()` flow; (3) a server check in `signup.ts` that rejects before `supabase.auth.signUp`. The checkbox `name` makes it serialize into `FormData`; the server treats "field absent/falsy → not consented" (an unchecked box sends no field).

## Phases at a Glance

| Phase                       | What it delivers                                  | Key risk                                              |
| --------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| 1. i18n + error plumbing    | Consent copy (3 locales) + `consent_required` code | Translation tone for pl/ru consent text               |
| 2. Client gate (form)       | Consent checkbox + inline validation + test       | Checkbox component must match FormField error UX/a11y |
| 3. Server enforcement       | Unbypassable server check + route test            | Check must precede `signUp` so no orphan account      |

**Prerequisites:** None — all touch points exist.
**Estimated effort:** ~1 session across 3 small phases.

## Open Risks & Assumptions

- `/terms` and `/privacy` will 404 until legal content is authored (tracked follow-up) — consent links are wired but lead to placeholders.
- Assumes "agree to ToS + Privacy together" is legally acceptable for this product (vs separate checkboxes).
- No proof-of-consent is retained; if compliance later needs an audit trail, that's a separate plan.

## Success Criteria (Summary)

- A user cannot register without checking consent, via the UI or a direct POST.
- The consent gate and its error render correctly in all three locales.
- `npm test`, `astro check`, and `npm run lint` all pass.
