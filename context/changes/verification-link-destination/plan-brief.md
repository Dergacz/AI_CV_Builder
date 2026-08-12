# Verification Link Destination — Plan Brief

> Full plan: `context/changes/verification-link-destination/plan.md`
> Upstream framing: `context/foundation/roadmap.md` → S-10

## What & Why

The confirmation link in the signup email opens `http://localhost:4321`. Every real registration on
production dead-ends at the verification step — the step S-02 built and S-01 exists to measure. This
change makes the link land on the deployed app and sign the user in.

## Starting Point

`signUp` (`src/pages/api/auth/signup.ts:22-31`) passes no `emailRedirectTo`, so GoTrue builds the link
from the hosted project's `Site URL`, which is still `localhost`. Research found the same omission in
`resend` (`src/pages/api/auth/resend.ts:31`) — the "I didn't get the email" recovery path. The
mechanics of the return trip already exist: `/auth/callback:32` exchanges a PKCE code for a session
for the Google flow.

## Desired End State

The emailed link opens `https://<prod-host>/auth/confirm`. Clicked in the signup browser, the user is
signed in and lands on `/dashboard`. Clicked on a phone — where the PKCE verifier cookie does not
exist — they land on `/auth/signin` with an "email confirmed, sign in to continue" notice, because the
address really was verified before the redirect. Expired links reuse the existing
`email_not_confirmed` message, which already says to resend.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Two causes, both in scope | Hosted `Site URL` **and** `emailRedirectTo` | Either alone leaves the link broken | Roadmap |
| Link destination | `/auth/callback`-style auto-login → `/dashboard` | Clicking the link signs you in; no password retype | Plan |
| Route mechanism | New `/auth/confirm`, not a `?flow=` flag on `/auth/callback` | Supabase docs don't confirm query strings participate in allow-list matching, and the failure mode is *silent* discard; a distinct path needs one exact entry. Also keeps OAuth consent logic out of the path | Plan |
| Cross-device failure | `/auth/signin?notice=email_confirmed` | GoTrue verifies before redirecting — a failed exchange means "wrong browser", not "failed" | Plan |
| Resend path | In scope, via a shared helper | Same missing option; a helper stops the two call sites drifting | Plan |
| Redirect origin | From `context.url` | Matches `oauth/google.ts:34`; no new deploy secret to forget — forgotten config is what caused this | Plan |
| Verification | Unit tests + a new manual check `M-5` | A unit test asserting "the option was passed" cannot see the hosted allow-list | Roadmap / Plan |

## Scope

**In scope:** shared `emailRedirectTo` helper; signup + resend wiring; new `/auth/confirm` route;
sign-in success-notice channel with en/pl/ru copy; local `config.toml` allow-list; hosted dashboard
config; README ops note; `R-16` + `M-5` in the test plan; S-10 closeout.

**Out of scope:** any `PUBLIC_SITE_URL` env var; Google OAuth / S-11; flipping local
`enable_confirmations`; an E2E spec for the emailed link; email template or SMTP changes;
password-reset and magic-link flows.

## Architecture / Approach

One helper builds `<request origin>/auth/confirm`; both email-sending routes use it. The new route
owns the return trip — exchange the code, sign in, `/dashboard`; on a missing verifier, redirect to
sign-in with a success notice; on an expired link, the existing error message. The sign-in page gains
a notice channel with the same allow-listed-code discipline its error channel already has. What the
code cannot reach — the hosted `Site URL` and allow-list — is corrected in the dashboard, written
down, and proven by a real click.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Redirect target + wiring | Helper, both call sites, `/auth/confirm`, local allow-list, route tests | Existing signup/resend tests build a context with no `url` — must be updated |
| 2. Sign-in notice | `?notice=email_confirmed` banner in en/pl/ru | Locale parity (R-08) fails on any catalog left out |
| 3. Hosted config + docs + proof | Dashboard fix, README, `R-16`/`M-5`, real production click-through | The allow-list entry must land *before* the click, or the link silently falls back to `Site URL` and looks half-fixed |

**Prerequisites:** dashboard access to the hosted Supabase project; a deploy to production; a phone
(or second browser profile) and a fresh real email address for `M-5`.
**Estimated effort:** ~1 session for phases 1-2; phase 3 is config + docs plus one production run.

## Open Risks & Assumptions

- The decisive verification is manual and un-gated by CI. That is a property of the defect, not a
  shortcut — recorded as `R-16`'s coverage note.
- Assumes GoTrue emits the PKCE `?code=` shape on confirmation redirects (as it does for the working
  Google flow). If a project-level setting produced implicit-flow links instead, the exchange branch
  would never fire and every click would take the "confirmed, sign in" path — degraded but not broken;
  `M-5` step 2 would catch it.
- Preview deploys (`wrangler.jsonc` `preview_urls: true`) emit an origin that cannot be allow-listed,
  so their links fall back to the production `Site URL`. Acceptable, and documented in Phase 3.
- Pre-existing unconfirmed accounts hold un-repairable `localhost` links; they recover via Resend.

## Success Criteria (Summary)

- A new user on production clicks the link in their email and is in the app, signed in.
- The same click from a phone tells them their email is confirmed and lets them sign in — no error.
- Resend produces a working link, so anyone stuck today can get themselves out.
