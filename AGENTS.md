# Repository Guidelines

AI CV Builder is an Astro 6 SSR app that turns user answers into a professional CV. Stack: Astro, React 19, TypeScript, Supabase Auth, Tailwind 4, shadcn/ui, Cloudflare Workers; product scope lives in @context/foundation/prd.md.

## Hard Rules

- Do not write to @context/archive/. Archived changes are immutable; open a new change instead.
- Keep MVP work inside @context/foundation/prd.md: one clean CV template, start-from-scratch questionnaire, simple section editing, PDF export, saved CVs, and no uploads, template marketplace, full document editor, billing, or cover letters unless the PRD changes.
- Do not add generic abstractions, app-wide state, queues, workers, or infrastructure unless the PRD requirement being implemented needs them.
- Treat `SUPABASE_URL` and `SUPABASE_KEY` as server-only secrets declared in @astro.config.mjs. Use `.env` for Node/Astro and `.dev.vars` for Cloudflare local dev; both are gitignored.
- Protect authenticated routes by updating `PROTECTED_ROUTES` in @src/middleware.ts, not by duplicating guards in individual pages.

## Commands

- `npm run dev` starts the Astro dev server.
- `npm run lint` runs ESLint with type-checked TypeScript, Astro, React, accessibility, React Compiler, and Prettier rules.
- `npm run build` runs the production build for the Cloudflare adapter.
- `npm run format` formats the repo with Prettier, including Astro and Tailwind class ordering.
- `npx astro sync` regenerates Astro types; CI runs it before lint/build.

## Project Structure

`src/pages/` contains Astro routes, with auth POST endpoints in `src/pages/api/auth/`. `src/components/auth/` holds interactive React auth form pieces; shared shadcn/ui components live in `src/components/ui/`. `src/lib/` holds Supabase, config-status, and utility helpers. `supabase/config.toml` is local Supabase config; there are no migrations yet.

## Coding Conventions

Use the `@/*` alias from @tsconfig.json for `src` imports. Prefer Astro components for static page/layout work and React components only for interactive islands. Use `cn()` from @src/lib/utils.ts for conditional Tailwind classes. API routes export uppercase `APIRoute` handlers such as `POST`. Treat @.prettierrc.json as the formatting source of truth.

## Testing and CI

No test runner or test script is configured yet; do not invent one in docs. The current verification gate is `npm run lint` plus `npm run build`. GitHub Actions in @.github/workflows/ci.yml runs on pushes and PRs to `master` and requires `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for build.

## Git and PRs

The current history uses a Conventional Commit-style `feat:` prefix. Limit each PR to one PRD requirement, one route/feature slice, or one tooling/doc update; call out any PRD scope change and whether lint/build were run.
