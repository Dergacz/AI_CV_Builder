# Test Plan — E2E risk slice (10xDevs M3L4)

Lightweight risk source for the `/10x-e2e` workflow. Lists only the browser-level
risks that justify an E2E test — those crossing multiple system boundaries (auth,
routing, API, database, SSR) where a unit test cannot prove the path. E2E is the
slowest, most fragile layer, so this stays deliberately short.

## R1 — Generated CV is lost after a page reload

- **Statement:** A user generates a CV, saves it, refreshes the page (or returns
  later) and the CV is gone — the data never survived the full path.
- **Boundaries crossed:** authenticated session → `POST /api/cv` → Supabase `cvs`
  (RLS) → dashboard server render (`dashboard.astro` → `SavedCvList`).
- **Impact:** High (loss of the product's core artifact). **Likelihood:** Medium.
- **Why E2E:** persistence only exists across auth + API + DB + SSR; no isolated
  function reproduces it.
- **Real vs mocked:** auth, save API, database, SSR are REAL. The external LLM is
  mocked at the app's own `/api/cv/generate` seam (generation runs server-side, so
  the OpenAI URL is not browser-interceptable).
- **Test:** `e2e/cv-persistence.spec.ts`.

## R2 — Unauthenticated user reaches protected resources

- **Statement:** A visitor with no session opens `/dashboard` or `/cv/*` and sees
  protected content instead of being redirected to sign in.
- **Boundaries crossed:** request → `src/middleware.ts` (cookie resolution +
  `PROTECTED_ROUTES`) → redirect.
- **Impact:** High (access-control failure). **Likelihood:** Low–Medium.
- **Why E2E:** the guard lives in middleware + cookie handling, only observable on
  a real request through the routing layer.
- **Real vs mocked:** fully real; nothing mocked.
- **Test:** `e2e/auth-redirect.spec.ts`.

## Seed

`e2e/seed.spec.ts` is the pattern exemplar (not a risk): it shows the four E2E
quality patterns on the real save→reopen flow so generated tests inherit them.
