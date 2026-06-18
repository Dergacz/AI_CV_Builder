---
change_id: enforce-email-verification
title: Enforce email verification
status: implemented
created: 2026-06-15
updated: 2026-06-18
archived_at: null
---

## Notes

### Ops: enabling enforcement in production

Email-verification enforcement has two layers:

1. **Middleware guard (code, config-independent)** — `src/middleware.ts` redirects any authenticated user with `!email_confirmed_at` away from `PROTECTED_ROUTES` to `/auth/confirm-email`. This is defense-in-depth and holds regardless of platform config.
2. **Supabase confirmations (platform)** — so that signup does not hand out a session before the email is confirmed, **production must set `enable_confirmations = true` in the hosted Supabase dashboard** (Authentication → Sign In / Providers → Email → "Confirm email"). This is an ops toggle, intentionally not a code change.

**Local stays auto-confirm on purpose.** `supabase/config.toml` keeps `enable_confirmations = false` so E2E auth (`e2e/auth.setup.ts`, no inbox in CI) works. The confirm-email resend UI renders only outside DEV (`import.meta.env.DEV`), so the full unconfirmed/resend path is exercised by unit/contract tests (`src/middleware.test.ts`, `src/pages/api/auth/resend.test.ts`, `src/lib/i18n/auth-errors.test.ts`) rather than a local browser run.

Recovery: unconfirmed users land on `/auth/confirm-email?email=…` and can self-serve via `POST /api/auth/resend` (`supabase.auth.resend`, rate-limited — a 429 surfaces the `rate_limited` message).
