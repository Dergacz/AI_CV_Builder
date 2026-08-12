# Google Sign-In Unavailable State — Plan Brief

> Full plan: `context/changes/google-unavailable-state/plan.md`

## What & Why

"Continue with Google" renders on both auth pages whether or not Supabase's Google provider is actually configured. On a deployment without credentials the button is a guaranteed dead end — clicking it hands the browser to Supabase's `/authorize`, which rejects with "Unsupported provider" outside our app. This change gives the app an availability signal and makes the surface degrade honestly, the way `/account` already does for account deletion.

## Starting Point

Google sign-in shipped complete in `google-signin-linking` (button → start endpoint → Google → callback → dashboard, with consent gating and auto-linking). What it did not ship is a configured-or-not signal: the credentials live in `supabase/config.toml` via `env()` locally and in the hosted dashboard in production, and neither variable appears in the app's `env.schema`. The start endpoint's existing error branch cannot help — `signInWithOAuth` only builds a URL, so it never sees the provider's rejection.

## Desired End State

A deployment without a Google client id serves both auth pages exactly as they looked before Google shipped: no button, no `or` divider, no explanatory copy. The start endpoint, still reachable by direct POST or stale HTML, redirects to `/auth/signin?error=google_unavailable` — a banner that names email and password as the way forward instead of advising a retry that cannot succeed. A configured deployment is byte-for-byte unchanged, with no new network calls on either page.

## Key Decisions Made

| Decision             | Choice                                              | Why (1 sentence)                                                                                                                                                              |
| -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Availability signal  | App-side env var, not a runtime probe               | Mirrors `isAdminConfigured()` — synchronous, pure, zero network cost, trivially testable; a probe would add a failure mode and non-determinism to two pages that have neither |
| Which variable       | Reuse `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`     | The same var `config.toml` already substitutes, so local setup stays one step and there is no way to set credentials without the signal                                       |
| Degraded UI          | Omit button **and** divider entirely                | A sign-in page owes no explanation for an absent option, and a dangling divider reads as a rendering bug; zero new copy means zero locale-parity surface                      |
| Placeholder handling | Blank `.env.example`, plain trim-check              | Keeps the predicate a one-liner identical to the precedent rather than baking a `###` sentinel into shipping code                                                             |
| Server gate          | Refuse in the start endpoint too                    | The endpoint is reachable regardless of what rendered; this is the call site that actually closes the dead end                                                                |
| Gate ordering        | After `consent_required`, before `setConsentCookie` | A refused signup must not leave an orphaned signed consent cookie with no round-trip to clear it                                                                              |
| Error code           | New `google_unavailable` + 3 locales                | `oauth_failed` advises a retry that can never work — conflating permanent config gaps with transient hiccups is the misleading-copy failure mode                              |
| E2E strategy         | Dummy client id via `webServer.env`                 | Follows `playwright.quota.config.ts:50`; the existing specs already stub the provider hop, so they never needed real credentials                                              |
| Coverage             | Unit + component + route, new `R-17`                | Matches what the identical deletion surface got, and satisfies the repo rule that a Testing Strategy cite a risk                                                              |

## Scope

**In scope:** env schema entry, `isGoogleAuthConfigured()` predicate, conditional rendering on both auth pages, start-endpoint refusal, `google_unavailable` error code in three locales, unit + render + route tests, E2E env dummy, `R-17`, README updates.

**Out of scope:** `/auth/v1/settings` probe; a separate feature flag; callback hardening (already funnels to `oauth_failed`); disabled-button or explanatory-note variants; config-banner integration; E2E coverage of the hidden state; any change to consent, linking, or the funnel event.

## Architecture / Approach

One pure predicate module (`src/lib/auth/google-provider.ts`), consulted server-side at the two places that could otherwise offer a dead end. The pages omit the affordance — cheap, cosmetic, the common path. The start endpoint refuses independently, because it stays reachable no matter what rendered. The React island is untouched: a component that is not rendered needs no `configured` prop.

## Phases at a Glance

| Phase                       | What it delivers                                       | Key risk                                                   |
| --------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| 1. Availability predicate   | Env var + `isGoogleAuthConfigured()` + blanked example | Nothing observable changes yet — easy to under-verify      |
| 2. Auth pages degrade       | Button and divider omitted together                    | Leaving a stray gap or an orphaned divider                 |
| 3. Server gate + error code | Endpoint refusal, `google_unavailable` in 3 locales    | Gate placed after `setConsentCookie` would orphan a cookie |
| 4. Coverage, risk, docs     | 3 test files, E2E dummy, `R-17`, README                | Forgetting the Worker var makes prod lose a working button |

**Prerequisites:** Local Supabase + Docker for the E2E leg. No Google credentials needed at any point — the dummy value is a signal, not a credential.
**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- **The one production regression path:** the client id must be set as a Cloudflare Worker var at deploy time, or Google sign-in — which works today — silently loses its button. Called out in Migration Notes with the `wrangler secret put` command.
- The signal is _presence_, not validity: a garbage client id still renders the button, and the user still dead-ends. Verifying the credential would require the provider round-trip this change deliberately avoids.
- The env var can drift from the hosted Supabase dashboard in either direction — accepted as the cost of the no-probe decision.

## Success Criteria (Summary)

- An unconfigured deployment shows no Google affordance on either auth page, in any locale.
- Reaching the start endpoint directly on such a deployment lands on the sign-in page with copy that points at a path that works.
- A configured deployment behaves exactly as it does today, with no added latency.
