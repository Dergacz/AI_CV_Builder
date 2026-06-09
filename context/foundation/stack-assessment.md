---
project: AI CV Builder
assessed_at: 2026-06-09T10:06:46Z
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript
  framework: Astro 6 (SSR) + React 19 islands
  build_tool: Astro CLI (Vite)
  test_runner: Vitest (+ Stryker mutation testing)
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 4
gates_failed: 0
---

## Stack Components

- **Language — TypeScript 5.9.** Strict mode via `tsconfig.json` extending
  `astro/tsconfigs/strict`. Boundary validation with zod 4. Type-checked lint rules
  through `typescript-eslint`.
- **Framework — Astro 6.3 (SSR, `output: server`) + React 19 islands.** File-based
  routing under `src/pages/`, island architecture for interactive components, shadcn/ui
  ("new-york") for UI primitives, Tailwind 4 for styling. Supabase provides auth and
  Postgres; OpenAI Chat Completions powers generation; `@react-pdf/renderer` handles
  PDF export.
- **Build tool — Astro CLI over Vite.** `astro build` produces the SSR bundle for the
  Cloudflare adapter (`@astrojs/cloudflare`); a `vite ^7.3.2` override is pinned.
- **Test runner — Vitest 4.1.** `npm test` runs `vitest run`; tests live beside sources
  as `src/**/*.test.ts`. Mutation testing is configured via Stryker
  (`stryker.config.json`, Vitest runner) as a selective gate.
- **Tooling — ESLint 9 (flat config) + Prettier 3.** `eslint.config.js` with
  typescript-eslint, astro, react, jsx-a11y, and react-compiler plugins; Prettier with
  astro + tailwindcss plugins. Pre-commit via husky + lint-staged.
- **Package manager — npm** (`package-lock.json`).
- **CI/CD — GitHub Actions** (`.github/workflows/ci.yml`, `deploy.yml`).
- **Deployment — Cloudflare Workers** (`wrangler.jsonc`, `@astrojs/cloudflare`).
- **Instruction files — both present:** `CLAUDE.md` (detailed, current) and `AGENTS.md`
  (partially stale — see Gaps & Compensation).

## Quality Gate Assessment

| Component               | Typed | Convention | Training Data | Documented | Verdict        |
|-------------------------|-------|------------|---------------|------------|----------------|
| Language (TypeScript)   | ✓     | —          | —             | —          | pass           |
| Framework (Astro+React) | —     | ✓          | ~             | ✓          | pass (caveat)  |
| Build tool (Astro/Vite) | —     | ✓          | ✓             | ✓          | pass           |
| Test runner (Vitest)    | —     | —          | ✓             | ✓          | pass           |

Legend: ✓ = pass, ✗ = fail, ~ = partial, — = not applicable

### Gate Details

**Type safety — pass.** `tsconfig.json` extends `astro/tsconfigs/strict` (strictest
preset). zod 4 (`zod` in dependencies) validates inputs at API boundaries
(`src/lib/*.schema.ts`, `request-body.ts`). `typescript-eslint` runs type-checked rules
in `eslint.config.js`. An agent can reason about input/output shapes from source alone.

**Convention — pass.** Astro is convention-strong (the criteria reference lists it
explicitly): file-based routes in `src/pages/`, island architecture, `@/*` path alias.
The project further documents conventions in `CLAUDE.md` (path alias, `cn()` merging,
shadcn placement, API-route shape with `prerender = false`, migration naming, RLS
policy). Folder layout is predictable.

**Popular in training data — pass, with a version-recency caveat.** Within the JS
family, every framework here is mainstream (Astro, React, Vitest, zod, Tailwind, ESLint
— all pass). The caveat: this project sits on **bleeding-edge major versions** that
postdate much training data — Astro 6, React 19 (+ React Compiler), Tailwind 4 (CSS-first
engine), ESLint 9 (flat config), zod 4, Vitest 4. An agent's internalized idioms often
default to the *previous* major (Tailwind 3 `tailwind.config.js`, legacy `.eslintrc`,
React 18 manual memoization, zod 3 APIs). The frameworks are popular; their newest
majors are not yet evenly represented. This is the sole reason the overall verdict is
"with-compensation" rather than "ready."

**Well-documented — pass.** Astro, React, Vitest, zod, Tailwind, and the Cloudflare
adapter all ship current, versioned official docs reachable by URL.

## Gaps & Compensation

No quality gate hard-fails. Two compensation areas remain, both legible and cheap to fix
in instruction files:

### Gap 1 — Version-recency idiom drift (the `~` on training data)

**Why it matters for agents:** without steering, an agent will generate previous-major
idioms — a `tailwind.config.js` (Tailwind 4 has none by default), a `.eslintrc` (the
project uses flat config), manual `useMemo`/`useCallback` (React Compiler handles it),
or zod 3 API shapes. These pass a glance but break the build or fight the toolchain.

**Compensation:** a short "Versions & idioms" block pinning the majors and their
gotchas (ready-to-paste below).

### Gap 2 — Stale, self-contradicting `AGENTS.md`

**Why it matters for agents:** `AGENTS.md` currently states *"No test runner or test
script is configured yet; do not invent one in docs"* and *"there are no migrations
yet."* Both are false now — `npm test` runs Vitest, Stryker is configured, and
`supabase/migrations/20260606103740_create_cvs.sql` exists. This **directly contradicts**
`CLAUDE.md`, which documents the full Vitest + Stryker setup and the migration
convention. An agent reading AGENTS.md would be steered *away* from writing tests — the
opposite of the project's actual practice.

**Compensation:** correct the two stale sections in `AGENTS.md` so the two instruction
files agree (ready-to-paste replacements below).

### Recommended Instruction File Additions

**1. Add a "Versions & idioms" section to `CLAUDE.md` (and mirror the key points in `AGENTS.md`):**

```markdown
## Versions & idioms (pinned — newer than common training data)

These majors postdate much training data; do not fall back to previous-major idioms:

- **Tailwind 4** — CSS-first via `@tailwindcss/vite`. There is NO `tailwind.config.js`;
  theme/tokens live in CSS (`@theme` in the global stylesheet). Do not generate a
  `tailwind.config.js` or v3-style JS config. Class ordering is enforced by
  `prettier-plugin-tailwindcss`.
- **ESLint 9** — flat config in `eslint.config.js`. Do NOT add `.eslintrc*` files or
  `extends` arrays of the legacy shape. New rules go into the flat config array.
- **React 19 + React Compiler** — `eslint-plugin-react-compiler` is active. Avoid manual
  `useMemo`/`useCallback`/`memo` for compiler-handled cases; write straightforward
  components. No `"use client"`/`"use server"` directives (these are Astro islands, not
  Next.js).
- **zod 4** — import from `zod`; verify against the installed v4 API (error customization
  and some method signatures changed from v3). Do not assume v3 idioms.
- **Astro 6** — API routes export `const prerender = false` and uppercase handlers
  (`GET`, `POST`). Run `npx astro sync` after changing content/types.
```

**2. Replace the stale "Testing and CI" section in `AGENTS.md`:**

```markdown
## Testing and CI

Unit/contract tests run with Vitest: `npm test` (`vitest run`); test files live beside
sources as `src/**/*.test.ts`, with the `@/*` alias mirrored in `vitest.config.ts`.
Mutation testing is configured via Stryker (`stryker.config.json`, Vitest runner) and run
narrowed to the module under change — `npx stryker run --mutate "src/lib/file.ts"`. The
verification gate is `npm run lint` + `npm run build` + `npm test`. GitHub Actions
(`.github/workflows/ci.yml`) runs lint + build on pushes/PRs to `master` and needs
`SUPABASE_URL` / `SUPABASE_KEY` secrets.
```

**3. Replace the stale migrations note in `AGENTS.md` "Project Structure":**

```markdown
Supabase migrations live in `supabase/migrations/` (naming: `YYYYMMDDHHmmss_description.sql`);
`supabase/config.toml` is local config. Always enable RLS on new tables with granular
per-operation, per-role policies.
```

## Summary

**Overall agent-readiness: ready-with-compensation** — and only lightly so. This is a
genuinely agent-friendly stack: strict TypeScript end-to-end, zod boundary validation,
a convention-strong framework (Astro), mainstream JS-ecosystem choices, current official
docs, a configured test runner plus mutation testing, type-checked linting, and an
already-detailed `CLAUDE.md`.

**Key strengths:** type safety (strict TS + zod + type-checked ESLint); strong, documented
conventions; a real verification gate (lint + build + Vitest + Stryker).

**Key gaps (both cheap to close):**
1. Bleeding-edge major versions (Astro 6, React 19, Tailwind 4, ESLint 9, zod 4, Vitest 4)
   drift ahead of training-data idioms — pin a "Versions & idioms" block.
2. `AGENTS.md` is stale and contradicts `CLAUDE.md` on tests and migrations — correct the
   two sections so the instruction files agree.

This matters for the upcoming commercial-readiness release: new surfaces (subscription/
entitlement, Google sign-in, payment-provider integration) will lean on exactly these
idioms (zod validation, Astro API routes, RLS on new tables). Closing the two gaps before
implementation reduces agent correction cycles.

**Recommended next step:** `/10x-health-check` — audit dependency health, the test suite,
and CI/CD coverage, focusing on the areas this assessment surfaced.
