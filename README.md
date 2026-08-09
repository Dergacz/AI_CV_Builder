# AI CV Builder

Most people who need a CV get stuck at the blank page. Not because they have nothing to say, but
because they do not know which sections belong there, how to describe their own work, or what
"professional" is supposed to look like.

AI CV Builder replaces the blank page with a short guided questionnaire. You answer plain questions
about yourself; the app turns those answers into a structured CV in one clean template, lets you edit
it section by section, saves it to your account, and exports it as a PDF.

It never invents career facts. If an answer does not support a section, the draft leaves it empty and
says so — a CV you cannot defend in an interview is worse than a short one.

![AI CV Builder landing page: "Turn simple answers into a professional CV draft", with a CV draft preview and the EN/PL/RU language switcher](docs/landing.png)

## What it does

- **Guided questionnaire** — seven plain-language fields (name, target role, experience, education,
  skills, spoken languages, extra context) plus the language the CV should be written in.
- **AI-generated draft** — answers become a structured draft with a summary, experience, education,
  skills, and languages, along with the assumptions the model made and warnings about thin input.
- **Section editing** — edit named sections in place. No full document editor, on purpose.
- **Saved CV library** — save, reopen, re-edit, and delete CVs from your account.
- **PDF export** — client-side rendering with fonts covering Latin, Polish diacritics, and Cyrillic.
- **Trilingual interface** — English, Polish, and Russian. The interface language and the CV output
  language are independent: reading the UI in Polish does not make your CV Polish.

## Tech stack

- [Astro](https://astro.build/) v6 — server-first rendering (`output: "server"`)
- [React](https://react.dev/) v19 — interactive islands only
- [TypeScript](https://www.typescriptlang.org/) v5
- [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) ("new-york")
- [Supabase](https://supabase.com/) — auth and Postgres with row-level security
- [zod](https://zod.dev/) v4 — request and model-output validation
- [@react-pdf/renderer](https://react-pdf.org/) — PDF export in the browser
- [OpenAI](https://platform.openai.com/) — draft generation via strict structured outputs
- [vitest](https://vitest.dev/) v4 — unit tests
- [Cloudflare Workers](https://workers.cloudflare.com/) — deployment target

## Prerequisites

- Node.js v22.14.0 (see `.nvmrc`)
- [Docker](https://www.docker.com/) with ~7 GB RAM, for the local Supabase stack
- An [OpenAI API key](https://platform.openai.com/api-keys) — without it the app runs, but CV
  generation returns a "service unavailable" state

## Getting started

```bash
git clone https://github.com/Dergacz/AI_CV_Builder.git
cd AI_CV_Builder
npm ci
```

Start the local Supabase stack (downloads Docker images on the first run):

```bash
npx supabase start
```

`npx supabase status` prints the credentials. Put the `Project URL` in `SUPABASE_URL` and the
**Publishable** key (`sb_publishable_…`) in `SUPABASE_KEY` — never the `Secret` one, which bypasses
row-level security. They go in two files: `.env` for the Astro/Node toolchain and `.dev.vars` for the
Cloudflare dev runtime. Both are gitignored; `.env.example` lists the keys:

```bash
cp .env.example .env
cp .env.example .dev.vars
```

Apply the database schema and regenerate the typed client:

```bash
npm run db:reset    # applies supabase/migrations/, creating public.cvs with its RLS policies
npm run db:types    # regenerates src/db/database.types.ts from the live schema
```

Run the dev server — it uses the Cloudflare `workerd` runtime, so it reads secrets from `.dev.vars`:

```bash
npm run dev         # http://localhost:4321
```

The local Supabase Studio is at `http://localhost:54323`.

### Email confirmation in local development

Confirmation is off by default locally (`enable_confirmations = false` under `[auth.email]` in
`supabase/config.toml`), so a new account can sign in immediately. Signup mail still goes to the local
mailbox UI at `http://localhost:54324` — its links are built from `site_url`, which the same file pins
to `http://localhost:4321`. Changing anything under `[auth.*]` requires
`npx supabase stop && npx supabase start`; the running container will not pick it up otherwise.

## Environment variables

All four are declared in `astro.config.mjs` under `env.schema` and are **server-only** — none reach
the client bundle. Every one is `optional`, so a missing value degrades a feature rather than
crashing the app.

| Variable         | Required for    | Missing-value behavior                                     |
| ---------------- | --------------- | ---------------------------------------------------------- |
| `SUPABASE_URL`   | auth, saved CVs | Config banner on every page; auth and persistence disabled |
| `SUPABASE_KEY`   | auth, saved CVs | Same as above (publishable/anon key — never a secret key)  |
| `OPENAI_API_KEY` | CV generation   | `POST /api/cv/generate` answers 503 `service_unavailable`  |
| `OPENAI_MODEL`   | —               | Falls back to `gpt-4o-mini`                                |

## Scripts

| Command                     | What it does                                                |
| --------------------------- | ----------------------------------------------------------- |
| `npm run dev`               | Dev server on the Cloudflare `workerd` runtime              |
| `npm run build`             | Production build (SSR via `@astrojs/cloudflare`)            |
| `npm run preview`           | Preview the production build                                |
| `npm run test`              | Unit tests (vitest)                                         |
| `npm run lint` / `lint:fix` | ESLint with type-checked rules                              |
| `npm run format`            | Prettier, including Astro and Tailwind class ordering       |
| `npm run db:start`          | Start the local Supabase stack                              |
| `npm run db:reset`          | Drop and rebuild the local DB from `supabase/migrations/`   |
| `npm run db:types`          | Regenerate `src/db/database.types.ts` from the local schema |

A husky pre-commit hook runs `eslint --fix` on staged `*.{ts,tsx,astro}` and `prettier --write` on
staged `*.{json,css,md}`.

## Project structure

```text
src/
├── pages/                    # Astro routes (server-rendered; no test files here — see below)
│   ├── api/auth/             # signin, signup, signout
│   ├── api/cv/               # index (list/create), [id] (read/update/delete), generate
│   └── cv/                   # new.astro (questionnaire), [id].astro (saved CV)
├── components/
│   ├── auth/                 # sign-in / sign-up React islands
│   ├── cv/                   # questionnaire, editor, template, PDF document, library
│   ├── hooks/                # useCvDraftEditor, useCvSave, useCvExport
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── services/             # cv-generation (OpenAI), cv-repository (persistence)
│   ├── i18n/                 # locale resolution and message catalogs
│   └── *.ts                  # schemas, copy, helpers (+ colocated unit tests)
├── tests/                    # route/API tests and shared fakes
├── db/database.types.ts      # generated by `npm run db:types`
├── middleware.ts             # resolves the user, guards PROTECTED_ROUTES
└── types.ts                  # shared entities and DTOs
supabase/migrations/          # SQL migrations
context/                      # product foundation and per-change plans (see below)
```

## Routes

| Route                          | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `/`                            | Landing page and entry point into CV creation  |
| `/auth/signin`, `/auth/signup` | Email/password auth                            |
| `/auth/confirm-email`          | Post-signup "check your inbox" page            |
| `/dashboard`                   | Saved CV library — open or delete previous CVs |
| `/cv/new`                      | Guided questionnaire and draft review          |
| `/cv/[id]`                     | Reopen a saved CV for editing and export       |

| API                                       | Methods                                         |
| ----------------------------------------- | ----------------------------------------------- |
| `/api/cv`                                 | `GET` list the caller's CVs, `POST` create      |
| `/api/cv/[id]`                            | `GET` read, `PUT` overwrite, `DELETE` remove    |
| `/api/cv/generate`                        | `POST` questionnaire answers → structured draft |
| `/api/auth/signin`, `/signup`, `/signout` | `POST`                                          |
| `/api/locale`                             | `POST` set the interface locale cookie          |

Authentication is cookie-based (`@supabase/ssr`). `src/middleware.ts` resolves the user on every
request and redirects anonymous traffic away from the paths in `PROTECTED_ROUTES` — add paths there
rather than duplicating guards in individual pages.

## Database

One table, `public.cvs`, created by `supabase/migrations/20260606103740_create_cvs.sql`:

- `draft` (JSONB) — the generated CV, validated against the zod schema in `src/lib/cv-draft.ts`.
- `source_snapshot` (JSONB) — the questionnaire answers that produced it, plus their version.
- `title`, `language`, `created_at`, `updated_at` — kept as flat columns so the dashboard can list
  CVs without loading any CV content.

Row-level security is enabled with owner-only policies on **select, insert, update, and delete**.
The repository layer (`src/lib/services/cv-repository.ts`) also filters every query on `user_id` as
a second, independent line of defense. A request for another account's CV answers `404`, never
`403` — a `403` would confirm the row exists.

## Testing

```bash
npm run test
```

Strategy, the risk register, and the manual checks that cannot be automated live in
[`context/foundation/test-plan.md`](context/foundation/test-plan.md). Two conventions matter:

- Helper tests sit next to their module in `src/lib/`; route, API, and cross-module tests go in
  `src/tests/`.
- **Never put a test file under `src/pages/`.** Astro turns every module there into a route, so the
  test becomes a public endpoint and pulls `vitest` into the deployed Worker bundle.
  `src/tests/no-tests-under-pages.test.ts` fails if this recurs.

## CI/CD

| Workflow                       | Trigger                  | Steps                                    |
| ------------------------------ | ------------------------ | ---------------------------------------- |
| `.github/workflows/ci.yml`     | Pull request to `master` | `astro sync` → `lint` → `test` → `build` |
| `.github/workflows/deploy.yml` | Push to `master`         | The same gates, then `wrangler deploy`   |

Repository secrets: `SUPABASE_URL` and `SUPABASE_KEY` for the build, plus `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` for deployment. Runtime secrets on Cloudflare are set separately with
`npx wrangler secret put <NAME>`.

To deploy by hand:

```bash
npm run build
npx wrangler deploy
```

## Documentation

The product is built from written foundation documents, not the other way round:

| Document                                                                       | Contents                                               |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [`context/foundation/prd.md`](context/foundation/prd.md)                       | Vision, persona, user stories, functional requirements |
| [`context/foundation/roadmap.md`](context/foundation/roadmap.md)               | Delivery slices F-01…S-09 with dependencies and status |
| [`context/foundation/test-plan.md`](context/foundation/test-plan.md)           | Test strategy and risk register                        |
| [`context/foundation/tech-stack.md`](context/foundation/tech-stack.md)         | Why this stack was chosen                              |
| [`context/foundation/infrastructure.md`](context/foundation/infrastructure.md) | Deployment platform decision and risk register         |
| [`context/foundation/lessons.md`](context/foundation/lessons.md)               | Recurring rules and pitfalls                           |
| `context/changes/<id>/`                                                        | Per-change briefs, plans, research, and reviews        |
| [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md)                            | Working agreements for AI coding agents                |

## License

MIT
