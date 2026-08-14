---
project: AI CV Builder
version: 1
status: active
created: 2026-08-09
updated: 2026-08-09
prd_version: 1
---

# Test Plan: AI CV Builder

> Cross-change testing strategy and risk register. Edit-in-place; archive when superseded.
> Per-change `plan.md` files reference risk IDs from this document instead of keeping their own lists.

## Strategy

Confidence is bought in three layers, cheapest first:

1. **Deterministic unit tests around contracts and drift** (vitest) carry most of the register —
   schemas, language boundaries, owner scoping, and error mapping are fully reachable there.
2. **A deliberately short E2E slice** (Playwright) covers only paths that cross several system
   boundaries at once — auth, routing, API, database, SSR — where no isolated function reproduces the
   failure. E2E is the slowest and most fragile layer, so a risk earns a browser test only when it
   cannot be proven below.
3. **Manual browser evidence** where real rendering is the only proof. PDF glyph rendering and
   cross-browser export stay here on purpose: they are exactly what a headless runner proves least
   about.

What that means in practice:

- A test exists to catch a **named risk**, not to raise a coverage number. Every entry in the register
  below states the failure it prevents.
- Contract seams get **agreement tests** — where two implementations must stay in step (client guard
  vs. zod schema, three locale catalogs), a test asserts they cannot drift apart silently.
- Anything requiring a real browser or a real model call that E2E does not cover is listed under
  [Manual verification](#manual-verification) and is explicitly _not_ faked into a green test.
- The external LLM is mocked at the app's own `/api/cv/generate` seam, never at the OpenAI URL —
  generation runs server-side and is not browser-interceptable.

## Stack and layout

|                                    |                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Unit runner                        | vitest 4 — `npm run test`                                                                 |
| Discovery                          | `src/**/*.test.ts` (`vitest.config.ts`)                                                   |
| Aliases                            | `@` → `src`; `astro:env/server` → `src/tests/support/astro-env.stub.ts`                   |
| Helper-level tests                 | next to their module in `src/lib/`                                                        |
| Route, API, and cross-module tests | `src/tests/`                                                                              |
| Shared fakes                       | `src/tests/support/`                                                                      |
| DB runner                          | pgTAP — `npm run test:db` (needs local Supabase up); `supabase/tests/database/*.test.sql` |
| E2E runner                         | Playwright — `npm run test:e2e` (needs local Supabase up)                                 |
| E2E specs                          | `e2e/*.spec.ts`; conventions and locators in `e2e/README.md`                              |
| E2E auth                           | `storageState` from `e2e/auth.setup.ts` + `e2e/fixtures/test-user.ts`                     |
| Mutation testing                   | Stryker — `npx stryker run --mutate "src/lib/file.ts"` (narrowed only)                    |

**Test files must never live under `src/pages/`.** Astro routes every module in that tree, so a
colocated test becomes a public endpoint and drags `vitest` into the Cloudflare Worker bundle. This
already happened once; `src/tests/no-tests-under-pages.test.ts` now fails if it recurs (R-09).

## Risk register

| ID   | Risk                                                                                            | Why it matters                                                                                                                         | Coverage                                                                                                                                                                                                                                                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Interface locale leaks into CV output, saved rows, or exported PDFs                             | A user reading the UI in Polish would silently get a Polish CV they did not ask for                                                    | `src/lib/i18n/cv-language-boundary.test.ts`                                                                                                                                                                                                                                                                                                                                                        |
| R-02 | The zod-free client guard and the zod schema drift apart                                        | The editor accepts a Save the server then rejects, or a draft breaks downstream in save/export                                         | `src/lib/cv-draft-agreement.test.ts` (client guards ⊆ schema), `src/lib/cv-draft-validation.test.ts`                                                                                                                                                                                                                                                                                               |
| R-03 | The model returns a non-conforming or fabricated draft                                          | Malformed content reaches persistence, or the CV states things the user never said                                                     | `generatedCvDraftSchema.safeParse` in `src/lib/services/cv-generation.ts` (re-validation after strict structured output) + anti-fabrication rules in the system prompt; content quality is manual                                                                                                                                                                                                  |
| R-04 | Oversized or malformed request bodies reach parsing and the model                               | Unbounded work on a Worker: latency, cost, and a trivially cheap abuse vector                                                          | `src/tests/api/cv-index.test.ts`, `src/tests/api/cv-generate-route.test.ts` — both assert the guard holds when `Content-Length` is absent                                                                                                                                                                                                                                                          |
| R-05 | One account reads, overwrites, or deletes another account's CV                                  | The single highest-consequence failure in the product: private career data crossing accounts                                           | DB: owner-only RLS on all four operations (`supabase/migrations/20260606103740_create_cvs.sql`). App: `src/tests/services/cv-repository.owner-scope.test.ts`. Routes: `src/tests/api/cv-item-routes.test.ts` (bare 404, never 403/500). Live RLS: [manual check M-1](#manual-verification)                                                                                                         |
| R-06 | Export filename mangles Unicode, or failures are misclassified                                  | A Cyrillic/Polish title yields an unusable file; a network blip reads as "your CV is broken"                                           | `src/lib/cv-export-filename.test.ts`, `src/lib/cv-export-error.test.ts`                                                                                                                                                                                                                                                                                                                            |
| R-07 | Output language does not survive generate → save → reopen → export                              | The north-star flow (S-08) silently degrades at one of four handoffs                                                                   | `src/lib/cv-full-flow-contract.test.ts`                                                                                                                                                                                                                                                                                                                                                            |
| R-08 | Locale catalogs diverge — a key exists in one language, not another                             | Untranslated English strings surface mid-flow to a Polish or Russian user                                                              | `src/lib/i18n/messages.test.ts` (key-path set parity), `src/lib/i18n/locales.test.ts`, `src/lib/i18n/auth-errors.test.ts`                                                                                                                                                                                                                                                                          |
| R-09 | Test or dev-only code ships in the production Worker bundle                                     | Dead public endpoints and dev dependencies inside the deployed Worker                                                                  | `src/tests/no-tests-under-pages.test.ts`                                                                                                                                                                                                                                                                                                                                                           |
| R-10 | PDF renders with missing glyphs (Polish diacritics, Cyrillic) or broken layout                  | The one artifact the user actually walks away with is unusable                                                                         | **Manual only** — [M-2](#manual-verification). vitest does not render PDFs                                                                                                                                                                                                                                                                                                                         |
| R-11 | Raw questionnaire answers or draft content end up in logs                                       | Private career data in observability output; violates the F-02 privacy contract                                                        | **Manual review** — enforced by the module contracts documented in `src/lib/services/cv-generation.ts` and `cv-repository.ts`                                                                                                                                                                                                                                                                      |
| R-12 | A generated CV is lost after a reload — persistence never survived the path                     | Loss of the product's core artifact, invisible to any single-layer test                                                                | **E2E** — `e2e/cv-persistence.spec.ts`. Real auth, save API, database, and SSR; only the LLM is mocked at `/api/cv/generate`                                                                                                                                                                                                                                                                       |
| R-13 | An unauthenticated visitor reaches `/dashboard` or `/cv/*`                                      | Access-control failure — protected content served without a session                                                                    | **E2E** — `e2e/auth-redirect.spec.ts`. Fully real; the guard lives in `src/middleware.ts` + cookie handling and is only observable through the routing layer                                                                                                                                                                                                                                       |
| R-14 | A user-scoped table stops cascading from `auth.users`                                           | Account deletion silently orphans personal data — erasure is claimed but not performed                                                 | **pgTAP** — `supabase/tests/database/account_deletion_cascade.test.sql` (`npm run test:db`). Behavioral proof for the four known tables plus a foreign-key inventory, so a NEW table without a cascade fails too                                                                                                                                                                                   |
| R-15 | The deletion confirmation gate lets through someone who is not the account owner                | Irreversible loss of everything a user has, one accidental click away                                                                  | **E2E** — `e2e/account-deletion.spec.ts` (never confirms; see the spec header). Server-side gate: `src/lib/account-deletion-confirmation.test.ts` + the route contract tests in `src/tests/api/`                                                                                                                                                                                                   |
| R-16 | The emailed confirmation link points somewhere the user cannot reach                            | Every new registration dead-ends at verification — the funnel step S-01 exists to measure                                              | Routes: `src/tests/api/auth-signup.test.ts`, `auth-resend.test.ts` (both senders pass a request-derived `emailRedirectTo`), `auth-confirm.test.ts` (all four landing branches). Destination correctness is **manual only** — [M-5](#manual-verification); see below                                                                                                                                |
| R-17 | An auth page offers a sign-in method the deployment cannot complete                             | The user leaves the app for a provider error page they cannot act on, with no way back in                                              | Predicate: `src/lib/auth/google-provider.test.ts` (unset / empty / whitespace boundary). Pages: `src/tests/auth-google-availability.test.ts` (guard wraps divider + button as one unit — static, see the file header for why). Route: `src/tests/api/auth-oauth-google.test.ts` (refusal + no orphaned consent cookie, now under the fields-free contract)                                         |
| R-18 | A Google account is created with no record that its owner accepted the Terms and Privacy Policy | No provable consent for an account that exists, and the fail-closed callback signs the user out mid-signup — the flow simply dead-ends | Route: `src/tests/api/auth-oauth-google.test.ts` (the consent cookie is set on EVERY start, whichever page the click came from). Component: `src/tests/google-consent-notice.test.ts` (notice rendered with both policy links — static, see the file header for why). **E2E** — `e2e/oauth-google.spec.ts` (notice visible and links resolve on both auth pages; first click reaches the provider) |

### Browser-level (E2E) risks

R-12, R-13, and R-15 are the risks that earn a browser test: each crosses authenticated session →
route → API → database → SSR, and no isolated function reproduces the failure. R-15 is the narrowest
case — the gate's state lives in the island and the dialog, so only a browser shows whether the
confirm button is really reachable — and it is deliberately non-destructive: the spec never confirms,
because the suite shares one `storageState` account. `e2e/seed.spec.ts` is
not a risk — it is the pattern exemplar, demonstrating the four E2E quality patterns on the real
save→reopen flow so generated tests inherit them. Before adding a spec, read `e2e/README.md`.

### Database-level (pgTAP) risks

R-14 is the only risk proven at the database layer. It belongs there because the guarantee _is_ the
schema: no application code re-checks the cascade, so no unit or browser test can observe its loss.
`npm run test:db` needs a running local stack and is not gated by CI (`ci.yml` has no Postgres),
exactly like the E2E suite.

### Configuration-level risks

R-16 is the only risk whose decisive check is a human clicking a link. The seam that failed lives in
the hosted Supabase dashboard (`Site URL` + the redirect allow-list), which no in-repo layer can read
— and GoTrue answers a non-allow-listed `redirect_to` by _silently_ substituting `Site URL`, so the
broken state is indistinguishable from the working one at every level the test suite can see. The
route tests lock what the code controls (both senders pass a request-derived `emailRedirectTo`, and
each landing branch routes to the right message); M-5 covers the rest. An E2E spec was considered and
rejected: local `enable_confirmations = false` keeps E2E auth working without an inbox (README), so
there is no confirmation email to click and a synthesized link would prove nothing about the hosted
allow-list.

### Coverage the register deliberately does not claim

- The RLS policies themselves are **not** proven by unit tests. `cv-repository.owner-scope.test.ts`
  drives the real repository functions through an in-memory client (`src/tests/support/fake-supabase.ts`),
  which proves the application-layer `.eq("user_id", …)` filters — the second line of defense — and
  nothing about Postgres. The first line needs a live database (M-1).
- Generated CV _quality_ is unverifiable automatically. The tests prove the draft's shape, language,
  and provenance; whether the prose is good is a human judgment.

## Manual verification

Run before closing any change that touches the flow in question.

**M-1 — Cross-account isolation (R-05).** With local Supabase running: account A saves a CV and notes
its id. Account B then confirms `GET /api/cv` omits it, `/cv/<idA>` renders a 404, `PUT` and
`DELETE /api/cv/<idA>` both answer 404, and the row is still intact for account A afterwards.

**M-2 — PDF export matrix (R-10, R-06).** Generate and export a CV in English, Polish, and Russian;
check diacritics and Cyrillic glyphs render, sparse drafts do not break layout, and the filename is
usable. Repeat in Chrome, Safari, Firefox, Edge, and one mobile viewport.

**M-3 — Failure states.** Generation unavailable (no API key), save failure, export failure with the
font request blocked, and reopening a missing or non-owned CV. Each must surface its own message with
the CV still on screen and no raw error text leaked.

**M-4 — Interface localization (R-01, R-08).** Switch UI locale on landing, auth, dashboard,
questionnaire, and review screens; confirm `<html lang>` follows, the choice survives a refresh, and
the CV output language is unaffected.

**M-5 — Confirmation-link destination (R-16).** Run against **production**, after the hosted `Site
URL` and redirect allow-list are set (README, "Email confirmation in production") and the build is
deployed — in that order, since an allow-list entry added later cannot repair links already sent.
With a fresh real address: sign up, and confirm the emailed link points at
`https://<prod-host>/auth/confirm` — no `localhost`, no bare landing-page URL. Click it in the signup
browser: it must land on `/dashboard`, already signed in. Sign up again and open that email on a
phone: it must land on `/auth/signin` showing the "email confirmed" notice, and signing in there must
work. Then check the recovery path — Resend from `/auth/confirm-email` produces a link with the same
destination — and the expiry path: re-clicking a consumed link shows the `email_not_confirmed`
message rather than a raw error. Finally confirm PostHog recorded funnel step 3 for the completed
signups.

## Gates

| Gate                | Command             | Enforced by                                             |
| ------------------- | ------------------- | ------------------------------------------------------- |
| Astro types         | `npx astro sync`    | `ci.yml`, `deploy.yml`                                  |
| Type check          | `npm run typecheck` | `ci.yml`, `deploy.yml`                                  |
| Lint (type-checked) | `npm run lint`      | `ci.yml`, `deploy.yml`, pre-commit hook on staged files |
| Unit tests          | `npm run test`      | `ci.yml`, `deploy.yml`                                  |
| Production build    | `npm run build`     | `ci.yml`, `deploy.yml`                                  |
| Database contracts  | `npm run test:db`   | Local, with Supabase up — not gated by CI               |
| E2E suite           | `npm run test:e2e`  | Local, with Supabase up — not gated by CI               |

`ci.yml` runs on pull requests to `master`; `deploy.yml` runs the same gates on push to `master` and
then deploys to Cloudflare Workers. E2E and manual checks are not gated by CI — they belong to the
change's own closure checklist.

## Adding a risk

1. Append a row here with the next `R-NN`, stating the **failure it prevents**, not the feature it covers.
2. Decide the coverage type honestly: automated, manual, or "accepted, untested" — the third is a valid
   answer for an MVP, but it must be written down rather than implied.
3. Reference the ID from the change's `plan.md` Testing Strategy section instead of restating the risk.
4. When a manual check becomes automatable, move it into the register and delete it from
   [Manual verification](#manual-verification) — the two lists must not describe the same work twice.
