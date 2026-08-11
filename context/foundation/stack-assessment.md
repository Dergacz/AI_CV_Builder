---
project: AI CV Builder
assessed_at: 2026-06-11T11:06:47Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript (strict)
  framework: Astro 6 SSR + React 19 islands
  build_tool: Astro CLI (Vite)
  test_runner: Vitest 4 (unit) + Playwright 1.60 (E2E) + Stryker (mutation)
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 4
gates_failed: 0
---

# Stack Assessment — AI CV Builder (Brownfield)

This assessment evaluates the existing stack against four agent-friendly criteria — type
safety, convention strength, training-data familiarity (per language family), and
documentation quality — and records compensation strategies for any friction. It does **not**
recommend replacing the stack. Scope context comes from the brownfield launch-readiness PRD
(`context/foundation/prd-v3.md`); the assessment itself is stack-level and independent of which
release is in flight.

> Supersedes the 2026-06-09 assessment. Key change since then: the previously-flagged stale
> `AGENTS.md` (which falsely claimed no test runner and no migrations) has been **corrected** —
> its "Testing and CI" and "Project Structure" sections now match reality. That gap is closed.

## Stack Components

- **Language — TypeScript (strict).** `tsconfig.json` extends `astro/tsconfigs/strict`. Used
  end-to-end across Astro pages, React islands, API routes, and `src/lib` services. `zod` ^4
  validates inputs at boundaries; `typescript-eslint` runs type-checked lint rules.
- **Framework — Astro 6.3 SSR (`output: server`) + React 19 islands.** `@astrojs/react` ^5,
  Tailwind 4 (`@tailwindcss/vite`), shadcn/ui ("new-york"). File-based routing under
  `src/pages/`, island architecture, request-time logic in `src/middleware.ts`. Supabase
  provides auth + Postgres; OpenAI Chat Completions powers generation; `@react-pdf/renderer`
  handles PDF export.
- **Build tool — Astro CLI over Vite.** `astro build` produces the SSR bundle for the
  Cloudflare adapter (`@astrojs/cloudflare` ^13); a `vite ^7.3.2` override is pinned.
- **Test runner — Vitest 4 + Playwright 1.60 + Stryker.** `npm test` → `vitest run`
  (`src/**/*.test.ts`); `@playwright/test` ^1.60 for E2E (`e2e/`, `playwright.config.ts`);
  `@stryker-mutator/core` ^9 with the Vitest runner for selective mutation testing.
- **Linting / formatting — ESLint 9 (flat config) + Prettier 3.** `eslint.config.js` with
  typescript-eslint, astro, react, jsx-a11y, react-compiler plugins; Prettier with astro +
  tailwindcss plugins. Pre-commit via husky + lint-staged.
- **Package manager — npm** (`package-lock.json`).
- **CI/CD — GitHub Actions** (`.github/workflows/ci.yml`, `deploy.yml`).
- **Deployment — Cloudflare Workers** (`wrangler.jsonc`, `@astrojs/cloudflare`).
- **Instruction files — both present and now mutually consistent:** `CLAUDE.md` (detailed,
  current) and `AGENTS.md` (test/CI and migration sections corrected since the last assessment).

## Quality Gate Assessment

| Component                       | Typed | Convention | Training Data | Documented | Verdict        |
|---------------------------------|-------|------------|---------------|------------|----------------|
| Language (TypeScript, strict)   |  ✓    |     —      |       —       |     —      | pass           |
| Framework (Astro 6 + React 19)  |  —    |     ✓      |       ~       |     ✓      | pass (caveat)  |
| Build tool (Astro / Vite)       |  —    |     ✓      |       ✓       |     ✓      | pass           |
| Test runner (Vitest+Playwright) |  —    |     —      |       ✓       |     ✓      | pass           |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable. **No hard failures; one caveat.**

### Gate Details

**Type safety — pass.**
Evidence: `tsconfig.json` extends `astro/tsconfigs/strict` (strictest preset). `zod` ^4
validates inputs at API/generation boundaries; `typescript-eslint` runs type-checked rules in
`eslint.config.js`. An agent can reason about input/output shapes from source alone.

**Convention strength — pass.**
Evidence: Astro is convention-strong (the criteria reference lists it explicitly): file-based
routes in `src/pages/`, island architecture, `src/middleware.ts`. The project layers explicit
conventions on top in `CLAUDE.md` and `AGENTS.md` — `@/*` alias, `cn()` class merging,
shadcn/ui placement, API-route shape (`prerender = false` + uppercase handlers), migration
naming, RLS policy convention. Folder layout is predictable.

**Training-data familiarity (per JS/TS family) — pass, with a version-recency caveat.**
Evidence: within the JS ecosystem, every framework here is mainstream (Astro, React, Vite,
Vitest, Playwright, zod, Tailwind, ESLint, Supabase). The caveat: the project sits on
**bleeding-edge major versions** that postdate much training data — Astro 6, React 19 (+ React
Compiler), Tailwind 4 (CSS-first), ESLint 9 (flat config), zod 4, Vitest 4. An agent's
internalized idioms often default to the *previous* major. The frameworks are popular; their
newest majors are not yet evenly represented — hence the `~` and the sole reason the verdict is
"with-compensation" rather than "ready."

**Documentation quality — pass.**
Evidence: Astro, React, Tailwind, Supabase, Vitest, Playwright, and the Cloudflare adapter all
ship current, versioned, URL-addressable official docs.

## Gaps & Compensation

No quality gate hard-fails. One load-bearing compensation area remains, plus one minor
documentation-currency advisory specific to the brownfield direction.

### Gap 1 — Version-recency idiom drift (the `~` on training data)

**Why it matters for agents:** without steering, an agent will generate previous-major idioms —
a `tailwind.config.js` (Tailwind 4 has none by default), a `.eslintrc` (the project uses flat
config), manual `useMemo`/`useCallback` (React Compiler handles it), zod-3 API shapes, or
`"use client"` directives that don't belong in Astro islands. These pass a glance but break the
build or fight the toolchain.

**Compensation (already in place):** `CLAUDE.md` carries a "Versions & idioms (pinned — newer
than common training data)" section that names each major and the idiom to avoid. This is the
right compensation and it exists today. The action item is to **keep it current and mirror its
key points into `AGENTS.md`** so both instruction files steer identically.

### Closed since last assessment — stale `AGENTS.md` test/migration claims

The 2026-06-09 assessment flagged `AGENTS.md` claiming "no test runner is configured" and "no
migrations yet" — both false and contradicting `CLAUDE.md`. **Verified resolved:** `AGENTS.md`
now documents Vitest + Stryker + the `npm run lint` + `npm run build` + `npm test` gate, and
the migrations directory/convention. No further action.

### Minor advisory — `AGENTS.md` scope pointer lags the brownfield PRD

`AGENTS.md` still references `@context/foundation/prd.md` (the greenfield v1 PRD) and frames its
"Hard Rules" around the original MVP ("no ... billing, or cover letters unless the PRD changes").
The PRD has since changed: `prd-v3.md` introduces the launch-readiness scope (enforced
verification, Google sign-in, legal pages + consent, analytics, error monitoring, feedback,
account deletion, generation cap). This is a documentation-currency drift, not a stack-gate
failure, but it will mislead an agent about what is in scope.

### Recommended Instruction File Additions

**1. Mirror the pinned-version idioms into `AGENTS.md`** (CLAUDE.md already has the canonical
copy; keep them in sync):

```markdown
## Version idioms (pinned — newer than common training data)

- Tailwind 4: CSS-first via `@tailwindcss/vite`. NO `tailwind.config.js`; tokens live in CSS
  (`@theme`). Never generate a v3-style JS config.
- ESLint 9: flat config in `eslint.config.js`. No `.eslintrc*` / legacy `extends` arrays.
- React 19 + React Compiler: avoid manual `useMemo`/`useCallback`/`memo` for compiler-handled
  cases. No `"use client"` / `"use server"` (these are Astro islands, not Next.js).
- zod 4: verify method signatures + error customization against the installed v4 API.
- Astro 6: API routes export `const prerender = false` and uppercase handlers (`GET`, `POST`).
  Run `npx astro sync` after content/type changes.
```

**2. Update the `AGENTS.md` scope pointer + hard rules to the brownfield release:**

```markdown
Product scope lives in @context/foundation/prd-v3.md (Launch-Readiness & Validation Release).
This is a brownfield change set on top of the existing MVP: enforced email verification +
resend, Google sign-in with verified-email linking, Privacy Policy + Terms of Service +
mandatory terms acceptance, product analytics over the funnel, centralized error monitoring,
post-generation feedback, account deletion, and a server-side daily generation cap.
Deferred (do not build): subscriptions/billing, premium AI tiers, ATS features, multiple
templates, photos, dark mode. The dormant subscriptions table + entitlements service stay inert.
```

**3. Reinforce the Cloudflare Workers runtime constraint** (relevant to the new launch-readiness
server code — analytics emission, error reporting, account deletion, usage counting):

```markdown
## Cloudflare Workers runtime constraint

Server code runs on the Cloudflare Workers (workerd) runtime, not Node.js. New server
capabilities must use `fetch`-compatible, Workers-safe APIs — no Node-only SDKs. Follow the
existing `src/lib/services/cv-generation.ts` pattern (plain `fetch`, no Node built-ins). Any
third-party analytics / error-monitoring client must have a Workers-compatible (edge/HTTP)
integration path.
```

> Forward note (tool selection, not a stack gap): `prd-v3.md` introduces analytics and
> error-monitoring dependencies that must be Workers-compatible and GDPR-aligned. That choice is
> made during implementation planning; it does not affect this stack's agent-readiness.

## Summary

**Overall agent-readiness: ready-with-compensation — and only lightly so.** This is a genuinely
agent-friendly stack: strict TypeScript end-to-end with zod boundary validation, a
convention-strong framework (Astro) reinforced by thorough instruction files, mainstream
JS-ecosystem choices with current versioned docs, a full test stack (unit + E2E + mutation),
type-checked linting, and a GitHub Actions gate running type-check + lint + test + build.

- **Key strengths:** type safety (strict TS + zod + type-checked ESLint); strong, documented
  conventions; a real verification gate (lint + build + Vitest + Stryker, plus Playwright E2E).
- **Remaining friction (all cheap to keep legible):**
  1. Bleeding-edge majors (Astro 6, React 19, Tailwind 4, ESLint 9, zod 4, Vitest 4) drift ahead
     of training-data idioms — keep `CLAUDE.md`'s pinned-idioms block current and mirror it into
     `AGENTS.md`.
  2. `AGENTS.md` scope pointer still names the greenfield v1 PRD and old MVP hard-rules — update
     it to `prd-v3.md` and the launch-readiness scope so the agent knows what's in/out of scope.
- **Closed since last assessment:** the stale AGENTS.md test/migration claims are corrected.

This matters for the upcoming launch-readiness implementation: new surfaces (verification gate,
Google sign-in, legal/consent, analytics, error monitoring, account deletion, generation cap)
lean on exactly these idioms — zod validation, Astro API routes with `prerender = false`, RLS on
new tables, and Workers-safe `fetch`. Keeping the two instruction-file items current reduces
agent correction cycles.

**Recommended next step:** `/10x-health-check` — audit dependency health, the test suite, and
CI/CD coverage, focusing on the areas this assessment surfaced.
