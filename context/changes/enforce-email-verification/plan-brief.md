# Enforce Email Verification — Plan Brief

> Full plan: `context/changes/enforce-email-verification/plan.md`

## What & Why

Users can currently reach protected content (`/dashboard`, `/cv`) with an unverified email — the middleware only checks that a session exists, never `email_confirmed_at`. This change enforces verification in a config-independent way and gives unconfirmed users an honest signin message plus a self-serve way to resend the confirmation email.

## Starting Point

`src/middleware.ts` gates `PROTECTED_ROUTES` on session presence alone. Signup already routes "no session" users to `/auth/confirm-email`, but a session issued for an unconfirmed user slips through. Signin maps every non-rate-limit error to a generic "check your password." Local Supabase has `enable_confirmations = false` (auto-confirm), which E2E auth depends on; production confirmation lives in the hosted dashboard.

## Desired End State

Authenticated-but-unconfirmed users are redirected to `/auth/confirm-email?email=...` on any protected route. An unconfirmed signin shows a dedicated "verify your email" message with a working **Resend** button. Local dev and E2E keep auto-confirm; prod enforces via the dashboard toggle plus the middleware guard as defense-in-depth.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Enforcement location | Middleware guard + signin handling | Config-independent; covers both session-but-unconfirmed and signin-rejected paths | Plan |
| Redirect target for blocked users | `/auth/confirm-email` | Reuses existing copy; tells the user what to do; not a protected route (no loop) | Plan |
| Local / E2E config | Keep `enable_confirmations = false` locally | Preserves E2E auth (no inbox in CI); enforce via code + prod dashboard | Plan |
| Unconfirmed signin UX | Dedicated `email_not_confirmed` message + resend link | Actionable recovery without support | Plan |
| Resend location | On `/auth/confirm-email` page | Single home for both post-signup and middleware-redirected users | Plan |
| Testing depth | Unit/contract for guard + routes | Fast, deterministic, matches repo convention | Plan |

## Scope

**In scope:** middleware `email_confirmed_at` guard; `email_not_confirmed` error code + 3-locale i18n; `POST /api/auth/resend` + button on confirm-email page; threading `?email=` through redirects; unit tests; ops docs.

**Out of scope:** migrating existing unconfirmed users; custom email templates/SMTP; flipping the prod toggle in code; password-reset / OAuth flows; changing local `config.toml`.

## Architecture / Approach

Two enforcement layers + recovery. (1) Middleware adds an `email_confirmed_at` check inside the existing `PROTECTED_ROUTES` branch → redirect to confirm-email. (2) `classifyAuthError` maps Supabase's `email_not_confirmed` to a dedicated UI code. (3) A small resend endpoint calls `supabase.auth.resend`. `email` flows via `?email=` from signup, middleware, and signin so resend always has the address.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Middleware guard | Unconfirmed sessions blocked from protected routes | Guard ordering vs funnel emit / redirect loop |
| 2. Signin handling | Honest `email_not_confirmed` message, 3 locales | Exhaustive i18n record must cover en/pl/ru |
| 3. Resend flow | `/api/auth/resend` + button on confirm-email | Supabase resend rate-limits (2/hr, 1s) |
| 4. Ops & docs | Prod toggle + local-stance documented | Toggle forgotten in prod (mitigated by guard) |

**Prerequisites:** none — all touch points exist. Production enforcement also needs the dashboard `enable_confirmations = true` (documented in phase 4).
**Estimated effort:** ~1-2 sessions across 4 phases (phase 4 is docs-only).

## Open Risks & Assumptions

- Local auto-confirm means the full unconfirmed browser path isn't exercised in CI; covered by unit/contract tests of the guard and routes instead.
- Production enforcement depends on the dashboard toggle being set; the middleware guard is the defense-in-depth backstop if it isn't.
- Assumes Supabase emits error code `email_not_confirmed` for unconfirmed signins (verify against installed `@supabase/supabase-js` during implementation).

## Success Criteria (Summary)

- An unconfirmed user cannot reach `/dashboard` or `/cv`; they land on confirm-email with their email attached.
- Unconfirmed signin shows a clear, translated message and a working resend action.
- E2E and local dev continue to pass unchanged.
