# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

### Google sign-in (OAuth)

"Continue with Google" is wired through Supabase's external Google provider, enabled in `supabase/config.toml` under `[auth.external.google]` via `env()` substitution. To exercise it locally:

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** of type **Web application**.
2. Add the Supabase auth callback as an **authorized redirect URI**: `http://127.0.0.1:54321/auth/v1/callback` (the local Supabase auth endpoint).
3. Put the client id and secret in your `.env` (see `.env.example`):

   ```bash
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client id>
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client secret>
   ```

4. Export these into the shell (or `source .env`) **before** running `npx supabase start` — the local Supabase container reads them via env substitution. `skip_nonce_check = true` is set for local; the app's own callback URL (`/auth/callback`) is allow-listed in `additional_redirect_urls`.

In production, set the same two values in the hosted Supabase dashboard (**Authentication → Providers → Google**) rather than in env files.

## PostHog Observability Configuration

This project uses PostHog EU Cloud for product analytics and error monitoring. PostHog is optional in local development; when `POSTHOG_API_KEY` is absent, observability emission is disabled and the app shows the configuration banner.

Create a PostHog EU Cloud project and store its keys in your local `.env` and `.dev.vars` files:

| Variable                | Description                                                     |
| ----------------------- | --------------------------------------------------------------- |
| `POSTHOG_API_KEY`       | Server-side PostHog project token for HTTP capture              |
| `POSTHOG_HOST`          | Server capture host; use `https://eu.i.posthog.com` by default  |
| `OBSERVABILITY_ID_SALT` | Server-only salt for deterministic pseudonymous user IDs        |
| `PUBLIC_POSTHOG_KEY`    | Browser-readable PostHog project token                          |
| `PUBLIC_POSTHOG_HOST`   | Browser capture host; use `https://eu.i.posthog.com` by default |

For Cloudflare Workers production, store secrets with Wrangler:

```bash
npx wrangler secret put POSTHOG_API_KEY
npx wrangler secret put OBSERVABILITY_ID_SALT
```

`POSTHOG_HOST` and `PUBLIC_POSTHOG_HOST` should remain on the EU ingest host unless the project intentionally moves regions or adds a first-party proxy.

### Smoke triggers (F-01 proof-of-life)

Two guarded triggers prove the observability pipeline reaches PostHog EU end-to-end. Both are **off by default** and must not be reachable by production traffic:

- **Server:** `GET|POST /api/observability/smoke` returns `404` unless `OBSERVABILITY_SMOKE_TOKEN` is set **and** the request supplies a matching token (header `x-observability-smoke-token` or `?token=`). Production never sets the secret, so the route stays a 404. When fired, it emits one `observability_smoke` event and one `observability_error`.
- **Client:** `window.__obsSmoke()` exists only in dev builds (guarded by `import.meta.env.DEV`). Call it from devtools to emit one client `observability_smoke` event and dispatch a test error through the browser error hook.

After F-01 verification, keep both disabled by leaving `OBSERVABILITY_SMOKE_TOKEN` unset (server) and shipping production builds (client trigger is stripped). The triggers carry only `surface`/`error_location`/`error_type` — never answer, prompt, draft, or CV content.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL`, `SUPABASE_KEY`, `POSTHOG_API_KEY`, and `OBSERVABILITY_ID_SALT` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## CI

GitHub Actions runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
