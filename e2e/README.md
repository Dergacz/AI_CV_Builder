# E2E conventions (project-specific)

Concrete conventions for this repo, on top of the generic rules in the `/10x-e2e`
skill (`references/e2e-quality-rules.md`, `e2e-anti-patterns.md`). Read this before
generating a new E2E test here.

## Stack & how to run

- **Playwright Test** (`@playwright/test`), DOM/snapshot mode. Specs live in `e2e/`
  as `*.spec.ts`; Vitest only globs `src/**/*.test.ts`, so the two never overlap.
- `npm run db:start` (local Supabase, Docker) → `npm run test:e2e`.
- `playwright.config.ts` boots `npm run dev -- --port 4321` via `webServer`, so the
  app starts automatically. `baseURL` = `http://localhost:4321`.

## Auth (storageState)

- Never log in through the UI inside a feature test. The `setup` project
  (`e2e/auth.setup.ts`) logs in once and writes `playwright/.auth/user.json`
  (gitignored); the `chromium` project reuses it via `storageState`.
- Credentials: `e2e/fixtures/test-user.ts` (stable, local-only throwaway account).
  Setup is idempotent — signs in, or signs up on a clean DB
  (`enable_confirmations = false` → immediate session).
- For an **anonymous** test (e.g. the auth-redirect risk), opt out per-file with
  `test.use({ storageState: { cookies: [], origins: [] } })`.

## Routes & locators

- Public: `/`, `/auth/signin`, `/auth/signup`. Protected (middleware
  `PROTECTED_ROUTES = ["/dashboard", "/cv"]`): `/dashboard`, `/cv/new`, `/cv/[id]`.
- UI is i18n; **default locale is `en`** — use the English accessible names.
  Forms use real `<label htmlFor>`, so prefer `getByLabel(...)` /
  `getByRole('button', { name: ... })`. Anchors:
  - Sign in: `getByLabel('Email')`, `getByLabel('Password', { exact: true })`,
    `getByRole('button', { name: 'Sign in' })`. (`{ exact: true }` on Password —
    signup also has "Confirm password".)
  - Questionnaire (`/cv/new`): `getByLabel('What name should appear on your CV?')`,
    forward buttons `Next` ×3 → `Review answers` → `Generate draft`.
  - Editor: `getByLabel('CV title')`, `getByRole('button', { name: 'Save', exact: true })`.
  - Library/reopen: saved CV renders as a heading with its title;
    `getByRole('heading', { name: title })`.

## Boundaries (real vs mocked)

- Keep **auth, the save API, Supabase, and SSR real** — that's where the risks live.
- **CV generation runs server-side**, so the OpenAI URL is NOT browser-interceptable.
  Mock at the app's own seam: `page.route('**/api/cv/generate', r => r.fulfill({ json: ... }))`
  with `buildGeneratedDraftResponse()` from `e2e/fixtures/cv-draft.ts`.

## Google OAuth ("Continue with Google") — `e2e/oauth-google.spec.ts`

- **Locators.** Default-locale (`en`) accessible name is `Continue with Google`:
  `getByRole('button', { name: /Google/ })`. On `/auth/signup` there are **two**
  consent checkboxes with identical name/label (SignUpForm's own + the Google
  button's), so role/label are ambiguous — scope to the Google form by its action
  contract, `page.locator('form[action="/api/auth/oauth/google"]')`, then use role
  locators within it (`getByRole('checkbox')`, the Google button). The signup
  consent gate is client-side: clicking without consent surfaces the validation
  error and does **not** navigate.
- **Mock seam (the provider hop).** The button POSTs to `/api/auth/oauth/google`,
  which runs `signInWithOAuth` **server-side** and 303-redirects the browser to
  Supabase's `/auth/v1/authorize` (which would then go to real Google). Stop the
  chain there — never reach Google — with
  `page.route('**/auth/v1/authorize**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '...' }))`.
  The request the browser makes to that URL is the proof the redirect was
  initiated; assert `provider=google` and `redirect_to` contains `/auth/callback`
  on it (via `page.waitForRequest`). The button → start endpoint → 303 boundary
  stays real; no session/account is created, so there is nothing to clean up.
  Run anonymous (`test.use({ storageState: { cookies: [], origins: [] } })`).
- **Manual-only.** The real Google round-trip (consent screen → callback →
  `/dashboard`, account auto-linking, consent stamping, funnel emit) needs real
  Google credentials and a human at the consent screen — it is **not** automated
  here. See the Manual Testing Steps in
  `context/changes/google-signin-linking/plan.md`.

## Data isolation & cleanup

- Unique ids via `Date.now()` in CV titles / names — no collisions in parallel or
  re-runs.
- Clean up created data in-test, plus an `afterEach` safety net:
  `await page.request.delete('/api/cv/${id}')` (shares the authenticated session).
- Supabase RLS: cleanup must run as the same user that created the row — the shared
  `page.request` already carries that session.

## Verify (don't trust green)

After a test is green, prove the assertion guards the risk by deliberately breaking
the protected behavior in production code (e.g. drop a route from `PROTECTED_ROUTES`,
or make `POST /api/cv` skip the insert), confirm the test goes red, then **revert** —
never commit the break.
