# Repository Guidelines

AI CV Builder is an Astro 6 SSR app that turns user answers into a professional CV. Stack: Astro, React 19, TypeScript, Supabase Auth, Tailwind 4, shadcn/ui, Cloudflare Workers; product scope lives in @context/foundation/prd-v3.md (Launch-Readiness & Validation Release — a brownfield change set on top of the original MVP).

## Hard Rules

- Do not write to @context/archive/. Archived changes are immutable; open a new change instead.
- Keep work inside @context/foundation/prd-v3.md (Wave A): the existing MVP flow (one clean CV template, start-from-scratch questionnaire, simple section editing, PDF export, saved CVs) plus the launch-readiness change set — enforced email verification + resend, Google sign-in with verified-email linking, Privacy Policy + Terms of Service + mandatory terms acceptance, product analytics over the funnel, centralized error monitoring, post-generation feedback, account deletion, and a server-side daily generation cap. Do NOT build the deferred items unless the PRD changes: subscriptions/billing, premium AI tiers, ATS features, multiple templates, photos, dark mode, cover letters, or old-CV upload/import. The dormant `public.subscriptions` table and `entitlements.ts` service stay inert.
- Do not add generic abstractions, app-wide state, queues, workers, or infrastructure unless the PRD requirement being implemented needs them.
- Treat `SUPABASE_URL` and `SUPABASE_KEY` as server-only secrets declared in @astro.config.mjs. Use `.env` for Node/Astro and `.dev.vars` for Cloudflare local dev; both are gitignored.
- Protect authenticated routes by updating `PROTECTED_ROUTES` in @src/middleware.ts, not by duplicating guards in individual pages.

## Commands

- `npm run dev` starts the Astro dev server.
- `npm run lint` runs ESLint with type-checked TypeScript, Astro, React, accessibility, React Compiler, and Prettier rules.
- `npm run test` runs the vitest suite.
- `npm run build` runs the production build for the Cloudflare adapter.
- `npm run format` formats the repo with Prettier, including Astro and Tailwind class ordering.
- `npx astro sync` regenerates Astro types; CI runs it before lint/test/build.
- `npm run db:reset` applies @supabase/migrations/ to the local database; `npm run db:types` regenerates @src/db/database.types.ts from it. Both need `npx supabase start` and Docker.

## Project Structure

`src/pages/` contains Astro routes: auth endpoints in `src/pages/api/auth/`, saved-CV endpoints in `src/pages/api/cv/` (`index.ts` list/create, `[id].ts` read/update/delete, `generate.ts` draft generation), and the CV screens in `src/pages/cv/`. `src/components/auth/` and `src/components/cv/` hold the React islands; shared shadcn/ui components live in `src/components/ui/`. `src/lib/` holds schemas, copy, and helpers, with extracted business logic in `src/lib/services/` (`cv-generation.ts`, `cv-repository.ts`) and interface localization in `src/lib/i18n/`. `src/tests/` holds route/API tests and shared fakes; `e2e/` holds the Playwright specs. `supabase/migrations/` holds the SQL migrations (naming: `YYYYMMDDHHmmss_description.sql`); `supabase/config.toml` is local Supabase config. Always enable RLS on new tables with granular per-operation, per-role policies.

## Coding Conventions

Use the `@/*` alias from @tsconfig.json for `src` imports. Prefer Astro components for static page/layout work and React components only for interactive islands. Use `cn()` from @src/lib/utils.ts for conditional Tailwind classes. API routes export uppercase `APIRoute` handlers such as `POST`. Treat @.prettierrc.json as the formatting source of truth. Never place `*.test.*` files under `src/pages/` — Astro turns them into routes and pulls `vitest` into the Worker bundle; route and API tests live in `src/tests/`, helper tests next to their module in `src/lib/`.

## Testing and CI

Tests run on vitest via `npm run test`; discovery is `src/**/*.test.ts`, with the `@/*` alias mirrored in @vitest.config.ts. The strategy and the risk register live in @context/foundation/test-plan.md — reference an existing `R-NN` risk from a change's Testing Strategy rather than restating it, and add a new row there when you cover a new failure mode. Browser-level risks are covered by Playwright (`npm run test:e2e`, specs in `e2e/`, conventions in `e2e/README.md`); mutation testing is configured via Stryker (@stryker.config.json, Vitest runner) and run narrowed to the module under change — `npx stryker run --mutate "src/lib/file.ts"`. The full verification gate is `npx astro sync`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. GitHub Actions in @.github/workflows/ci.yml runs those gates on pull requests to `master`; @.github/workflows/deploy.yml repeats them on push to `master` and then deploys to Cloudflare Workers. Both need `SUPABASE_URL` and `SUPABASE_KEY` repository secrets for the build step.

## Git and PRs

The current history uses a Conventional Commit-style `feat:` prefix. Limit each PR to one PRD requirement, one route/feature slice, or one tooling/doc update; call out any PRD scope change and whether lint/build were run.
`/10x-implement <change-id>` must create or switch to a branch named exactly `<change-id>` before edits or commits; do not commit feature work directly to `master`.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 1

Bootstrap a greenfield project end-to-end with the **shaping chain**:

```
/10x-init  →  /10x-shape  →  /10x-prd  →  (10x-tech-stack-selector)  →  (bootstrapper)
```

The first three skills ship in this lesson; the last two are the next links in the chain.

### Task Router — Where to start

| Skill                   | Use it when                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Project setup**       |                                                                                                                                                                                                                                                                                                                                                                           |
| `/10x-init`             | The project directory is fresh. Scaffolds `context/foundation/lessons.md` and `docs/reference/contract-surfaces.md` so the rest of the workflow has somewhere to write. Run this once per project.                                                                                                                                                                        |
| **Discovery**           |                                                                                                                                                                                                                                                                                                                                                                           |
| `/10x-shape`            | You have an idea and need to turn it into structured shape-notes BEFORE writing a PRD. Greenfield only. Walks vision → persona/access → MVP → FRs (with Socratic challenge) → business logic & data → stack-openness sketch. Surfaces empty-CRUD and MVP-too-big anti-patterns by name. Output: `context/foundation/shape-notes.md` with a resumable `checkpoint:` block. |
| **Document generation** |                                                                                                                                                                                                                                                                                                                                                                           |
| `/10x-prd`              | You have shape-notes (or raw notes) and want a schema-conformant `context/foundation/prd.md`. Generates against the locked schema, routes every gap verbatim into `## Open Questions`, and refuses to invent domain decisions. On collision, prompts overwrite vs. versioned save (`prd-vN.md`).                                                                          |

### How the chain hands off

- `/10x-init` produces the workflow v2 scaffold (`context/foundation/`, `lessons.md`, `contract-surfaces.md`). `/10x-shape` requires this and will offer to delegate to `/10x-init` if it's missing.
- `/10x-shape` writes `context/foundation/shape-notes.md` with frontmatter `checkpoint:` (current_phase, phases_completed, frs_drafted, quality_check_status). On re-entry, it resumes from the next unfinished phase.
- `/10x-prd` reads `shape-notes.md` (default) or any path you pass, scores the input on a 4-signal heuristic, warns on thin input, and writes `context/foundation/prd.md` against the schema at `skills/10x-shape/references/prd-schema.md` (frontmatter aligned 1:1 with 10x-tech-stack-selector's Q1–Q7).

### What the PRD captures (and what it does NOT)

- **Captured**: vision, persona, success criteria, user stories (Given/When/Then), FRs (FR-NNN), NFRs, business logic (one-sentence rule first), data model, access control, durable implementation decisions, testing strategy, deployment & CI/CD strategy, non-goals, open questions.
- **NOT captured (deliberate)**: framework choices, database choices, file paths, deployment platform. Stack openness is binding — only `product_type` and `tech_preferences.language_family` capture stack-shaped intent. Frameworks are 10x-tech-stack-selector's job.

### Anti-patterns surfaced during shaping

- **Empty-CRUD**: business logic that reduces to "users add and remove records" with no domain rule. `/10x-shape` names it explicitly and prompts for a real rule shape (recommendation, prioritization, classification, validation, scoring, workflow, calculation).
- **MVP-too-big**: first-flow estimate exceeds ~1 week of after-hours work, or > 4 distinct user actions before user-visible value, or requires multiple integrations before payoff. Skill names the expensive pieces and offers concrete scope-down moves.

Both are **soft gates**: they warn but allow override. Overrides are recorded in the checkpoint and surfaced in the PRD's `## Open Questions`.

### Foundation paths used by this lesson

- `context/foundation/shape-notes.md` — `/10x-shape` output
- `context/foundation/prd.md` (or `prd-vN.md`) — `/10x-prd` output
- `context/foundation/lessons.md` — recurring rules & pitfalls (scaffolded by `/10x-init`)
- `docs/reference/contract-surfaces.md` — load-bearing names registry (scaffolded by `/10x-init`)

### Universal language

The shipped skills carry no 10xDevs / cohort / certification references. The mechanics (Socratic challenge, gray-area discovery, recommended-answer fatigue mitigation, soft quality gate) are universal indicators of a well-scoped greenfield project.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
