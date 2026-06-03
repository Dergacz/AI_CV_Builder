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
`/10x-implement <change-id>` must create or switch to a branch named exactly `<change-id>` before edits or commits; do not commit feature work directly to `master`.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill                                  | Use it when                                                                                                                                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Change setup (lesson focus)**        |                                                                                                                                                                                                                                                                      |
| `/10x-new <change-id>`                 | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`.               |
| **Planning (lesson focus)**            |                                                                                                                                                                                                                                                                      |
| `/10x-plan <change-id>`                | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)**      |                                                                                                                                                                                                                                                                      |
| `/10x-plan-review <change-id>`         | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin.                                                                          |
| **Implementation (lesson focus)**      |                                                                                                                                                                                                                                                                      |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`.                                                                                                                          |
| **Lifecycle closure**                  |                                                                                                                                                                                                                                                                      |
| `/10x-archive <change-id>`             | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state.                                                                                                                                                             |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
