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

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 1

Move from sprint-zero setup to project orchestration with the **roadmap chain**:

```
(Module 1 foundation docs) -> /10x-roadmap -> backlog-ready roadmap items
```

`/10x-roadmap` is the lesson focus. `/10x-new` is intentionally introduced in Module 2, Lesson 2, when a selected roadmap item becomes an implementation change folder.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Roadmap (lesson focus)** | |
| `/10x-roadmap` | You have `context/foundation/prd.md` and a scaffolded project baseline, and you need a vertical-first MVP roadmap. The skill reads the PRD, inspects the code baseline, uses available foundation docs such as `tech-stack.md`, `infrastructure.md`, and `deploy-plan.md`, then writes `context/foundation/roadmap.md`. Use it BEFORE creating per-change folders or implementation plans. |
| **Re-run upstream if needed** | |
| `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-infra-research` | Bundled from Module 1 so foundation contracts can be fixed before roadmap sequencing. If roadmap generation exposes a PRD gap, repair the PRD before pretending the backlog is ready. |

### How the chain hands off

- `/10x-roadmap` bridges product and implementation. It does not choose frameworks, design schemas, or write a per-change implementation plan.
- The output is `context/foundation/roadmap.md`: ordered milestones, vertical slices, bounded foundations, dependencies, unknowns, risk, and backlog handoff fields.
- Roadmap items should receive stable human-readable identifiers in backlog tools. The actual `context/changes/<change-id>/` folder is created in Lesson 2 with `/10x-new`.

### Roadmap boundaries

- Default to vertical slices: user-visible outcomes that cross UI, data, business logic, and integrations.
- Horizontal work is allowed only as a bounded enabler that names the downstream vertical milestone it unlocks.
- Avoid orphan horizontal work such as "build the whole database", "build all API endpoints", or "design the whole UI" before the first user-visible flow.
- Roadmap is not a calendar estimate. Do not invent dates, story points, or sprint velocity unless the user explicitly asks for a separate planning artifact.

### Foundation paths used by this lesson

- `context/foundation/prd.md` - input
- `context/foundation/tech-stack.md` - optional input
- `context/foundation/infrastructure.md` - optional input
- `context/deployment/deploy-plan.md` - optional input
- `context/foundation/roadmap.md` - output
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
