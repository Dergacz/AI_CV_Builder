# Cloudflare Workers Deployment Plan

## Summary

Deploy AI CV Builder as an Astro SSR app on **Cloudflare Workers**, using Cloudflare Builds connected to GitHub, a first production URL on `workers.dev`, and a renamed Worker resource: `ai-cv-builder`.

This plan follows `context/foundation/infrastructure.md`, current repo config, and current Astro/Cloudflare docs: `@astrojs/cloudflare` deploys SSR to Workers, not Cloudflare Pages.

## Key Changes

- [ ] Update `wrangler.jsonc`:
  - Change `"name"` from `10x-astro-starter` to `ai-cv-builder`.
  - Keep `main: "@astrojs/cloudflare/entrypoints/server"`, `assets.directory: "./dist"`, `nodejs_compat`, and observability enabled.
- [ ] Keep `astro.config.mjs` on the current Workers SSR path:
  - `output: "server"`
  - `adapter: cloudflare()`
  - server-only `SUPABASE_URL` and `SUPABASE_KEY`
- [ ] Do not use `wrangler pages deploy`; use Workers commands only:
  - Build: `npm run build`
  - Dry run: `npx wrangler deploy --dry-run`
  - Deploy: `npx wrangler deploy`
  - Secrets: `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`
  - Rollback: `npx wrangler deployments list`, then `npx wrangler rollback <VERSION_ID>`
  - Logs: `npx wrangler tail ai-cv-builder`
- [ ] Treat Astro's generated Worker config as the deploy-time truth:
  - `npx wrangler deploy` uses the generated `dist/server/wrangler.json` after `npm run build`.
  - Expected bindings after build/deploy: `ASSETS`, `SESSION`, and `IMAGES`.
  - `ASSETS` serves static files, `SESSION` is the Astro Cloudflare KV session binding, and `IMAGES` is the Cloudflare Images binding used by the adapter's default image service.
- [ ] Configure Cloudflare Builds from GitHub:
  - Production branch: `master`
  - Install command: `npm ci`
  - Build command: `npx astro sync && npm run build`
  - Deploy command: `npx wrangler deploy`
  - Runtime secrets in Cloudflare Workers: `SUPABASE_URL`, `SUPABASE_KEY`
  - Build-time env, if required by Cloudflare build execution: same two values as non-public secrets.
  - Do not rely on build-time variables as runtime secrets; configure runtime values in Worker Variables & Secrets.
- [ ] Keep GitHub Actions as the quality gate:
  - Existing CI stays responsible for `npm ci`, `npx astro sync`, `npm run lint`, and `npm run build`.
  - Cloudflare Builds is responsible for production deploy after the connected GitHub branch updates.

## Deployment Phases

### Phase 1: Preflight

- [ ] Confirm local Node uses `.nvmrc` / Node 22.
- [ ] Run `npm ci` if dependencies are not installed.
- [ ] Run `npx astro sync`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Confirm `dist/` is produced and no build errors mention missing Supabase env.
- [ ] Run `npx wrangler deploy --dry-run`.
- [ ] Confirm the dry run reports Worker `ai-cv-builder` and bindings `ASSETS`, `SESSION`, and `IMAGES`.
- [ ] Confirm `.env`, `.dev.vars`, and `.wrangler/` remain gitignored.

### Phase 2: Cloudflare Project Setup

- [ ] Authenticate with Cloudflare via `npx wrangler login` for the first manual check.
- [ ] Apply the Worker rename to `ai-cv-builder`.
- [ ] Create or let Wrangler create the Worker during first deploy.
- [ ] Choose one secret setup path before the first production smoke test:
  - Preferred for first deploy: deploy code and secrets together with `npx wrangler deploy --secrets-file .env.production`, then remove the local file or keep it gitignored.
  - Alternative: run the first `npx wrangler deploy`, then add runtime secrets with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`, then repeat the smoke test.
- [ ] Remember that `npx wrangler secret put` creates a new Worker version and deploys it immediately; treat secret changes as production deploy events.
- [ ] Verify secret presence from Cloudflare dashboard or Wrangler without printing values.
- [ ] Verify the deployed Worker has `ASSETS`, `SESSION`, and `IMAGES` bindings. If `SESSION` or `IMAGES` were auto-provisioned, record the created resources in deployment notes.

### Phase 3: First Manual Deploy

- [ ] Run `npm run build`.
- [ ] Run `npx wrangler deploy --dry-run`.
- [ ] Run `npx wrangler deploy`.
- [ ] Record the produced `workers.dev` URL.
- [ ] Smoke test:
  - `/` renders.
  - `/auth/signin` renders.
  - `/auth/signup` renders.
  - `/dashboard` redirects unauthenticated users to `/auth/signin`.
  - Sign-up/sign-in works if Supabase email settings allow it.
- [ ] Run `npx wrangler tail ai-cv-builder` during the smoke test and confirm no runtime errors.

### Phase 4: Cloudflare Builds

- [ ] Connect the GitHub repo in Cloudflare Builds.
- [ ] Set production branch to `master`.
- [ ] Set install/build/deploy commands from this plan.
- [ ] Add Cloudflare build/deploy credentials using Cloudflare's GitHub integration or scoped token flow.
- [ ] Configure `SUPABASE_URL` and `SUPABASE_KEY` as runtime Worker secrets, not only as build variables.
- [ ] Add build-time copies only if the Cloudflare build process fails without them.
- [ ] Trigger a build from `master`.
- [ ] Confirm Cloudflare build logs show:
  - install succeeded,
  - Astro sync/build succeeded,
  - `wrangler deploy` deployed Worker `ai-cv-builder`.
  - Worker bindings include `ASSETS`, `SESSION`, and `IMAGES`.

### Phase 5: Rollback and Support Checks

- [ ] Run `npx wrangler deployments list` and save the current version ID in the deployment notes.
- [ ] Confirm rollback path is understood before launch:
  - `npx wrangler rollback <VERSION_ID>`
- [ ] Confirm rollback caveat:
  - Worker rollback does not revert Supabase data, secrets, bindings, or DNS changes.
- [ ] Validate the Worker runtime before building high-risk MVP features:
  - PDF export library compatibility with Workers.
  - AI request timing and timeout behavior.
  - Supabase latency from expected user region.
  - `nodejs_compat` assumptions for any Node-like package.

## Test Plan

- [ ] Local verification: `npx astro sync`, `npm run lint`, `npm run build`.
- [ ] Dry-run verification: `npx wrangler deploy --dry-run` shows Worker `ai-cv-builder` and expected bindings.
- [ ] First deploy verification: `npx wrangler deploy`.
- [ ] Runtime verification: `npx wrangler tail ai-cv-builder` while hitting public routes.
- [ ] Auth verification: sign-up/sign-in flow against the configured Supabase project.
- [ ] Protection verification: unauthenticated `/dashboard` redirects to `/auth/signin`.
- [ ] CI verification: GitHub Actions passes on `master`.
- [ ] Cloudflare Builds verification: production deploy succeeds from `master`.
- [ ] Rollback verification: deployment list shows at least one previous version and rollback command is documented, but do not execute rollback unless needed.

## Assumptions

- Cloudflare Builds is the production deploy path, not GitHub Actions deploy.
- First public URL is `workers.dev`; custom domain is deferred.
- Worker name should be `ai-cv-builder`.
- Supabase remains external and is configured through `SUPABASE_URL` and `SUPABASE_KEY`.
- No database migrations exist yet, so deployment rollback only needs app/runtime rollback for now.
- Astro Cloudflare currently generates `SESSION` and `IMAGES` bindings during build/deploy. They must be checked during dry run and first deploy even though they are not hand-written in `wrangler.jsonc`.
- `npx wrangler secret put` is a deploy operation because it creates and deploys a new Worker version.
- Current docs checked through Context7: Astro Cloudflare adapter docs and Cloudflare Workers/Wrangler docs.

## Execution Notes - 2026-05-29

- CLI deploy path completed with `npx wrangler deploy`.
- Public URL: `https://ai-cv-builder.sats96dergach.workers.dev`.
- Worker name: `ai-cv-builder`.
- Auto-provisioned KV namespace: `ai-cv-builder-session` for binding `SESSION`.
- Active runtime bindings verified: `ASSETS`, `SESSION`, `IMAGES`, `SUPABASE_URL`, `SUPABASE_KEY`.
- Current active version after secret upload: `eb79f1a0-c900-41e5-ba3d-13d92d03be5e`.
- Route smoke test passed:
  - `/` returns `200`.
  - `/auth/signin` returns `200`.
  - `/auth/signup` returns `200`.
  - `/dashboard` redirects unauthenticated users to `/auth/signin`.
  - Fake same-origin sign-in POST returns Supabase `Invalid login credentials`, confirming runtime Supabase secrets are active.
- `wrangler tail ai-cv-builder` showed `outcome: ok` and no exceptions for the smoke-test requests.
- GitHub-connected Cloudflare Builds remains pending unless completed in the Cloudflare dashboard.
- Local command caveat: this machine ran the preflight under Node `v24.14.0`; `.nvmrc` still targets Node `22.14.0`, and GitHub Actions uses Node 22.
