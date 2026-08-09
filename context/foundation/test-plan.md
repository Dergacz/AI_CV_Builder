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

The MVP buys confidence with **cheap deterministic unit tests around contracts and drift**, plus
**manual browser evidence** where real rendering is the only proof. There is deliberately no e2e
framework: the expensive part of this product (PDF glyph rendering, cross-browser export) is exactly
the part a headless runner would prove least about, and the cheap part (schemas, language boundaries,
owner scoping, error mapping) is fully reachable from vitest.

What that means in practice:

- A test exists to catch a **named risk**, not to raise a coverage number. Every entry in the register
  below states the failure it prevents.
- Contract seams get **agreement tests** — where two implementations must stay in step (client guard
  vs. zod schema, three locale catalogs), a test asserts they cannot drift apart silently.
- Anything requiring a live database, a real browser, or a real model call is listed under
  [Manual verification](#manual-verification) and is explicitly _not_ faked into a green test.

## Stack and layout

|                                    |                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Runner                             | vitest 4 — `npm run test`                                               |
| Discovery                          | `src/**/*.test.ts` (`vitest.config.ts`)                                 |
| Aliases                            | `@` → `src`; `astro:env/server` → `src/tests/support/astro-env.stub.ts` |
| Helper-level tests                 | next to their module in `src/lib/`                                      |
| Route, API, and cross-module tests | `src/tests/`                                                            |
| Shared fakes                       | `src/tests/support/`                                                    |

**Test files must never live under `src/pages/`.** Astro routes every module in that tree, so a
colocated test becomes a public endpoint and drags `vitest` into the Cloudflare Worker bundle. This
already happened once; `src/tests/no-tests-under-pages.test.ts` now fails if it recurs (R-09).

## Risk register

| ID   | Risk                                                                           | Why it matters                                                                                 | Coverage                                                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R-01 | Interface locale leaks into CV output, saved rows, or exported PDFs            | A user reading the UI in Polish would silently get a Polish CV they did not ask for            | `src/lib/i18n/cv-language-boundary.test.ts`                                                                                                                                                                                                                                                |
| R-02 | The zod-free client guard and the zod schema drift apart                       | The editor accepts a Save the server then rejects, or a draft breaks downstream in save/export | `src/lib/cv-draft-agreement.test.ts` (client guards ⊆ schema), `src/lib/cv-draft-validation.test.ts`                                                                                                                                                                                       |
| R-03 | The model returns a non-conforming or fabricated draft                         | Malformed content reaches persistence, or the CV states things the user never said             | `generatedCvDraftSchema.safeParse` in `src/lib/services/cv-generation.ts` (re-validation after strict structured output) + anti-fabrication rules in the system prompt; content quality is manual                                                                                          |
| R-04 | Oversized or malformed request bodies reach parsing and the model              | Unbounded work on a Worker: latency, cost, and a trivially cheap abuse vector                  | `src/tests/api/cv-index.test.ts`, `src/tests/api/cv-generate-route.test.ts` — both assert the guard holds when `Content-Length` is absent                                                                                                                                                  |
| R-05 | One account reads, overwrites, or deletes another account's CV                 | The single highest-consequence failure in the product: private career data crossing accounts   | DB: owner-only RLS on all four operations (`supabase/migrations/20260606103740_create_cvs.sql`). App: `src/tests/services/cv-repository.owner-scope.test.ts`. Routes: `src/tests/api/cv-item-routes.test.ts` (bare 404, never 403/500). Live RLS: [manual check M-1](#manual-verification) |
| R-06 | Export filename mangles Unicode, or failures are misclassified                 | A Cyrillic/Polish title yields an unusable file; a network blip reads as "your CV is broken"   | `src/lib/cv-export-filename.test.ts`, `src/lib/cv-export-error.test.ts`                                                                                                                                                                                                                    |
| R-07 | Output language does not survive generate → save → reopen → export             | The north-star flow (S-08) silently degrades at one of four handoffs                           | `src/lib/cv-full-flow-contract.test.ts`                                                                                                                                                                                                                                                    |
| R-08 | Locale catalogs diverge — a key exists in one language, not another            | Untranslated English strings surface mid-flow to a Polish or Russian user                      | `src/lib/i18n/messages.test.ts` (key-path set parity), `src/lib/i18n/locales.test.ts`, `src/lib/i18n/auth-errors.test.ts`                                                                                                                                                                  |
| R-09 | Test or dev-only code ships in the production Worker bundle                    | Dead public endpoints and dev dependencies inside the deployed Worker                          | `src/tests/no-tests-under-pages.test.ts`                                                                                                                                                                                                                                                   |
| R-10 | PDF renders with missing glyphs (Polish diacritics, Cyrillic) or broken layout | The one artifact the user actually walks away with is unusable                                 | **Manual only** — [M-2](#manual-verification). vitest does not render PDFs                                                                                                                                                                                                                 |
| R-11 | Raw questionnaire answers or draft content end up in logs                      | Private career data in observability output; violates the F-02 privacy contract                | **Manual review** — enforced by the module contracts documented in `src/lib/services/cv-generation.ts` and `cv-repository.ts`                                                                                                                                                              |

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

## Gates

| Gate                | Command          | Enforced by                                             |
| ------------------- | ---------------- | ------------------------------------------------------- |
| Astro types         | `npx astro sync` | `ci.yml`, `deploy.yml`                                  |
| Lint (type-checked) | `npm run lint`   | `ci.yml`, `deploy.yml`, pre-commit hook on staged files |
| Unit tests          | `npm run test`   | `ci.yml`, `deploy.yml`                                  |
| Production build    | `npm run build`  | `ci.yml`, `deploy.yml`                                  |

`ci.yml` runs on pull requests to `master`; `deploy.yml` runs the same gates on push to `master` and
then deploys to Cloudflare Workers. Manual checks are not gated by CI — they belong to the change's
own closure checklist.

## Adding a risk

1. Append a row here with the next `R-NN`, stating the **failure it prevents**, not the feature it covers.
2. Decide the coverage type honestly: automated, manual, or "accepted, untested" — the third is a valid
   answer for an MVP, but it must be written down rather than implied.
3. Reference the ID from the change's `plan.md` Testing Strategy section instead of restating the risk.
4. When a manual check becomes automatable, move it into the register and delete it from
   [Manual verification](#manual-verification) — the two lists must not describe the same work twice.
