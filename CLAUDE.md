# Rules for AI

This file provides guidance to AI Agent when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

## Architecture

**Astro 6 SSR app** with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components. Deployed to Cloudflare Workers.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`. Always enable RLS on new tables with granular per-operation, per-role policies.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/components/hooks/`.
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## Versions & idioms (pinned — newer than common training data)

These majors postdate much training data; do not fall back to previous-major idioms:

- **Tailwind 4** — CSS-first via `@tailwindcss/vite`. There is NO `tailwind.config.js`; theme/tokens live in CSS (`@theme` in the global stylesheet). Do not generate a `tailwind.config.js` or v3-style JS config. Class ordering is enforced by `prettier-plugin-tailwindcss`.
- **ESLint 9** — flat config in `eslint.config.js`. Do NOT add `.eslintrc*` files or `extends` arrays of the legacy shape. New rules go into the flat config array.
- **React 19 + React Compiler** — `eslint-plugin-react-compiler` is active. Avoid manual `useMemo`/`useCallback`/`memo` for compiler-handled cases; write straightforward components. No `"use client"`/`"use server"` directives (these are Astro islands, not Next.js).
- **zod 4** — import from `zod`; verify against the installed v4 API (error customization and some method signatures changed from v3). Do not assume v3 idioms.
- **Astro 6** — API routes export `const prerender = false` and uppercase handlers (`GET`, `POST`). Run `npx astro sync` after changing content/types.

## CI

GitHub Actions runs `astro sync` + `astro check` + lint + test + build on every PR to master (`.github/workflows/ci.yml`); `deploy.yml` runs the same gate then deploys to Cloudflare Workers on push to master. Requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

## Testing

- Unit/contract tests: `npm test` (Vitest). Test files live next to sources as `src/**/*.test.ts`; the `@/*` alias is mirrored in `vitest.config.ts`.
- Mutation testing: `stryker.config.json` (Vitest runner). Run **narrowed** to the module under change — `npx stryker run --mutate "src/lib/file.ts"`, or by line range `--mutate "src/lib/file.ts:12-40"`. Only run it for code touched by the current change or a risk in `test-plan.md`. Artifacts land in `reports/` (gitignored). For the full selective-gate workflow and how to triage survived mutants, see "Mutation testing (Stryker)" in the 10xDevs section below.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->

### Project E2E conventions

Before generating an E2E test in this repo, read **`e2e/README.md`** — it pins the
project specifics the generic skill rules don't know: routes + English (default
locale) accessible names for locators, the `storageState` auth setup
(`e2e/auth.setup.ts` + `e2e/fixtures/test-user.ts`), the generation mock seam
(`page.route('**/api/cv/generate', …)` since generation runs server-side), and
cleanup via `page.request.delete('/api/cv/${id}')`. Run with local Supabase up:
`npm run db:start` → `npm run test:e2e`.
