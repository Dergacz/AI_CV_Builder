# Google Sign-In with Account Linking — Plan Brief

> Full plan: `context/changes/google-signin-linking/plan.md`

## What & Why

Add "Continue with Google" to an auth system that is currently email/password only, so users can sign in faster. "Linking" means a Google login connects to the user's **existing** account (by verified email) instead of creating a duplicate.

## Starting Point

Supabase cookie-session auth with redirect-based email/password flows and **no OAuth code anywhere** — no `signInWithOAuth`, no callback route. Signup enforces a Terms/Privacy consent checkbox and stamps consent into user metadata; middleware blocks unconfirmed emails.

## Desired End State

Both auth pages show a Google button (consent-gated on signup, bare on signin). A Google login completes through a new `/auth/callback` route and lands on `/dashboard`, auto-linking to any existing account with the same verified email. New Google accounts carry consent metadata and produce one `funnel_signup_completed{method:"google"}` event. Failures fall back to the existing sign-in error banner.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Linking semantics | Auto-link by verified email | Supabase default; zero duplicates, no extra UI | Plan |
| Consent capture | Checkbox before redirect, stamped in callback | Preserves the explicit-consent legal posture for new accounts | Plan |
| Consent transport | Short-lived signed httpOnly cookie | Server-controlled, survives the redirect, fits cookie-session model | Plan |
| Button placement | Both signin + signup (shared component) | Returning users on signin, consent only where accounts are created | Plan |
| New-via-signin edge case | Callback enforces consent; bounce new+no-consent to signup | No account reaches the app without recorded consent | Plan |
| Callback failure UX | Redirect to `/auth/signin?error=<code>` | Reuses existing ServerError banner + auth-errors i18n | Plan |
| Analytics | Emit `signup_completed{method:"google"}` for new users only | Keeps the funnel intact and segmentable | Plan |
| Secrets/config | Env-var substitution + documented setup | No secrets in git; matches the Apple stub; works local + prod | Plan |
| Destination | `/dashboard`, same as password | Consistent; middleware already guards it | Plan |
| Testing | Unit seams + E2E up to the redirect | Deterministic coverage; real Google hop stays manual | Plan |

## Scope

**In scope:** Google provider config, OAuth start endpoint + signed consent cookie, callback route (link/consent/funnel/error), shared Google button on both pages, 3-locale strings, unit + E2E coverage, docs.

**Out of scope:** Other providers; unlink/disconnect UI; account-settings page; mismatched-email reconciliation; `returnTo` deep links; manual `linkIdentity()`.

## Architecture / Approach

Button → POST `/api/auth/oauth/google` (validates consent for signup intent, sets signed consent cookie, calls `signInWithOAuth`, redirects to Google) → Google → `/auth/callback` (`exchangeCodeForSession`, detect new-vs-returning, stamp consent + emit funnel for new accounts or bounce if no consent, clear cookie, redirect `/dashboard`). Supabase auto-links matching verified emails with no extra code.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Config & secrets | Google provider enabled, env vars documented | Requires Google OAuth credentials to exercise locally |
| 2. Start endpoint + consent cookie | Consent-gated OAuth initiation + signed cookie | Cookie must survive the redirect (sameSite=lax, signed) |
| 3. Callback route | Code exchange, link/consent/funnel/error logic | Reliable new-vs-returning detection |
| 4. Google button UI | Shared island on both pages, 3-locale copy | Consent-gating UX on signup |
| 5. Tests & docs | Unit + E2E-to-redirect, README update | Real Google login can't be E2E-driven (manual only) |

**Prerequisites:** Google Cloud OAuth client (client id + secret) for local/prod; local Supabase + Docker.
**Estimated effort:** ~3–4 sessions across 5 phases.

## Open Risks & Assumptions

- Relies on Supabase's automatic identity-linking for verified-matching emails (default behavior) — confirm it's not disabled in the hosted project.
- New-vs-returning detection in the callback must be robust; auto-linked accounts can carry multiple identities on first Google login.
- Real Google OAuth is verified manually only; E2E stops at the redirect.

## Success Criteria (Summary)

- Google login works from both pages and lands authenticated on `/dashboard`.
- Matching-email Google logins link to the existing account; new accounts record consent + one funnel event.
- OAuth failures and consent-missing new accounts are handled with clear, localized redirects.
