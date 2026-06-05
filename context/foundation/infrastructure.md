---
project: AI CV Builder
researched_at: 2026-05-28
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 SSR + React 19
  runtime: Cloudflare Workers
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare Workers is the right MVP platform because the repo already uses `@astrojs/cloudflare`, `wrangler`, `output: "server"`, and a Workers config in `wrangler.jsonc`. The interview answers favored low cost, no persistent connections, external managed services, and single-region users; Cloudflare keeps the deploy path closest to the scaffold while still giving a generous free or low-cost path for 10k-100k monthly requests. The older `deployment_target: cloudflare-pages` hint in `tech-stack.md` should be treated as superseded for Astro 6 SSR: the current Astro Cloudflare adapter is Workers-first, and Astro docs state that Cloudflare Pages is no longer supported by the adapter.

## Platform Comparison

Scoring uses Pass = 2, Partial = 1, Fail = 0. Hard filter: none of the candidates were eliminated because the app does not require persistent processes. Compatibility penalty: platforms requiring an adapter/runtime migration were kept, but ranked below the current Workers path.

| Platform           | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
| ------------------ | --------- | ------------------ | ------------------- | ----------------- | ----------------- | ----- |
| Cloudflare Workers | Pass      | Pass               | Pass                | Pass              | Pass              | 10/10 |
| Vercel             | Pass      | Pass               | Pass                | Pass              | Partial           | 9/10  |
| Netlify            | Partial   | Pass               | Pass                | Partial           | Pass              | 8/10  |
| Railway            | Pass      | Partial            | Pass                | Partial           | Pass              | 7/10  |
| Render             | Partial   | Partial            | Pass                | Partial           | Partial           | 6/10  |
| Fly.io             | Pass      | Partial            | Partial             | Partial           | Partial           | 6/10  |

Cloudflare Workers supports the current Astro SSR runtime with `@astrojs/cloudflare`, `wrangler deploy`, `wrangler rollback`, `wrangler tail`, Worker preview URLs, Markdown/LLM-friendly docs, and Cloudflare MCP servers. Workers Free includes 100,000 requests/day with CPU limits; Workers Paid is $5/month with included request and CPU allocations. Sources: https://docs.astro.build/en/guides/integrations-guide/cloudflare/, https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/, https://developers.cloudflare.com/workers/platform/pricing/, https://developers.cloudflare.com/workers/wrangler/commands/workers/, https://developers.cloudflare.com/workers/configuration/previews/.

Vercel is the strongest familiar fallback. It has excellent CLI deployment, logs, rollback, free Hobby allowances for small apps, official Astro SSR support through `@astrojs/vercel`, and an official MCP server in beta. The cost of choosing it is a runtime migration away from the current Cloudflare adapter and Wrangler config. Sources: https://vercel.com/docs/frameworks/frontend/astro, https://vercel.com/docs/cli, https://vercel.com/docs/limits, https://vercel.com/docs/agent-resources/vercel-mcp.

Netlify is also familiar and agent-friendly, with Netlify CLI, official MCP, `llms.txt`, and Astro SSR support through `@astrojs/netlify`. It ranks behind Vercel because rollback is API/UI-oriented rather than a simple CLI command, and the current project would still need an adapter and env flow migration. Sources: https://docs.astro.build/en/guides/integrations-guide/netlify/, https://cli.netlify.com/commands/deploy/, https://cli.netlify.com/commands/logs/, https://docs.netlify.com/build/build-with-ai/netlify-mcp-server/, https://www.netlify.com/pricing/.

Railway is good for containerized Node apps and has strong CLI/log support, `llms.txt`, and agent tooling. It would require replacing the Cloudflare adapter with `@astrojs/node` or Docker, and pricing is resource-based rather than request-based. Sources: https://docs.railway.com/guides/astro, https://docs.railway.com/cli/up, https://docs.railway.com/cli/logs, https://docs.railway.com/pricing/plans.

Render is a reasonable Node web-service host with free test instances, deploy/log CLI, official docs, `llms.txt`, and MCP support. For a polished MVP demo, the free web-service spin-down and missing first-class CLI rollback make it a weaker fit. Sources: https://render.com/docs/deploy-astro, https://render.com/docs/free, https://render.com/docs/cli-reference, https://render.com/docs/rollbacks.

Fly.io is powerful when persistent processes or low-level container control matter. This MVP does not need that, and Fly has no true free tier for new accounts, requires a Node/container migration, and has more operational surface than serverless Workers. Sources: https://fly.io/docs/launch/deploy/, https://fly.io/docs/about/pricing/, https://fly.io/docs/about/cost-management/, https://docs.astro.build/en/guides/deploy/flyio/.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Cloudflare Workers won because it matches the repo's current adapter, `wrangler.jsonc`, `wrangler` dependency, and README deployment path. It also best satisfies the cost constraint: static assets are cheap, small dynamic volume fits the free or $5/month tier, and external Supabase is acceptable because co-location was not required.

#### 2. Vercel

Vercel scored second because the user already has Vercel/Netlify familiarity, the Hobby plan is enough for low-volume validation, and the CLI has straightforward deploy/log/rollback commands. It loses to Workers because moving this repo to Vercel requires replacing `@astrojs/cloudflare` with `@astrojs/vercel` and revalidating runtime behavior.

#### 3. Netlify

Netlify scored third because it is familiar, supports Astro SSR, has an official MCP server, and has a cost-controlled free path. It trails Vercel because rollback is less CLI-native and the current app would still need adapter, function-region, and secrets migration work.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate - Weaknesses

1. PDF export or AI packages may assume Node APIs, Chromium, filesystem access, native binaries, or long-lived processes that do not run in the Workers runtime.
2. The current Astro 6 Cloudflare path is Workers-first. Following older Cloudflare Pages examples would create a wrong deployment model for SSR.
3. Supabase remains external, so edge rendering does not remove Auth/DB round trips. A poor Supabase region choice can still create latency.
4. AI generation and PDF rendering may create long request paths; typical generation must be tested against real Worker CPU and wall-clock behavior before launch.
5. `wrangler rollback` restores Worker code, but not changed secrets, deleted bindings, KV/D1 resources, or Supabase migrations.

### Pre-Mortem - How This Could Fail

Six months after launch, Cloudflare looked like the obvious choice but failed because the team treated "Cloudflare starter" as proof that every MVP feature was runtime-compatible. PDF export landed late and depended on a Node/Chromium package that could not run in Workers. AI generation sometimes exceeded comfortable request timing, especially with weak user input and retries. Secrets worked locally through `.env`, but production needed Worker secrets and Cloudflare runtime access, causing confusing auth failures during deploy. The team also mixed Pages and Workers instructions, which made preview deployments unreliable. Supabase was hosted in a region that made authenticated requests slower than expected for the actual user base. None of these were fatal alone, but together they turned deployment into a week of runtime rewrites right before demo. The real mistake was not choosing Cloudflare; it was postponing runtime validation for PDF export, AI calls, secrets, and Supabase round trips until the end.

### Unknown Unknowns

- Astro Cloudflare adapter v13+ changed old assumptions: SSR should deploy to Workers with `wrangler deploy`, not Cloudflare Pages.
- Worker preview URLs are useful for PR review, but preview URL logs are limited; production-style logging still needs `wrangler tail` or Cloudflare observability on deployed Workers.
- Static assets can be free or very cheap, but SSR routes execute dynamic Worker code unless individual routes are explicitly prerendered.
- `nodejs_compat` does not mean full Node runtime support. Validate PDF and AI SDK dependencies early.
- Preview deployments and production deployments may share top-level bindings unless environments are intentionally separated.

## Operational Story

- **Preview deploys**: Use Cloudflare Workers Builds connected to GitHub, or a GitHub Action that runs `npx wrangler versions upload` for PRs to create Worker preview URLs without promoting them to production. Keep preview secrets separate before exposing real user CV data.
- **Secrets**: Store `SUPABASE_URL` and `SUPABASE_KEY` as Worker secrets with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`; keep `.env` for local Astro/Node and `.dev.vars` for Cloudflare local dev. Do not commit secrets into `wrangler.jsonc` or MCP config.
- **Rollback**: Use `npx wrangler deployments list` to inspect versions and `npx wrangler rollback <VERSION_ID>` to promote a previous Worker version. Rollback is immediate for Worker code, but bindings, secrets, and Supabase schema/data changes must be handled separately.
- **Approval**: Agents may run read-only log checks and preview deploys after token setup. A human approves production deploy, primary secret rotation, deletion of Worker resources, domain changes, and any Supabase schema/data migration.
- **Logs**: Use `npx wrangler tail 10x-astro-starter` for live runtime logs, `npx wrangler deployments status` for deployment state, GitHub Actions logs for CI, and Cloudflare dashboard observability read-only for production investigation.

## Risk Register

| Risk                                                             | Source           | Likelihood | Impact | Mitigation                                                                                                                                              |
| ---------------------------------------------------------------- | ---------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF export library does not run in Workers                       | Devil's advocate | High       | High   | Spike PDF export before building full editor flow; choose a Workers-compatible renderer or isolate PDF generation behind an external service if needed. |
| AI generation exceeds comfortable Worker request behavior        | Devil's advocate | Medium     | High   | Test the full prompt path with the intended model; add timeouts, retry boundaries, and clear failure UI before launch.                                  |
| Old Pages guidance causes wrong deploy setup                     | Unknown unknowns | Medium     | Medium | Treat `wrangler.jsonc` and `@astrojs/cloudflare` docs as source of truth; deploy SSR with `npx wrangler deploy`, not `wrangler pages deploy`.           |
| Supabase region adds latency from Workers                        | Research finding | Medium     | Medium | Pick a Supabase region close to expected users; measure authenticated request timing before public demo.                                                |
| Secrets diverge between `.env`, `.dev.vars`, GitHub, and Workers | Pre-mortem       | Medium     | High   | Maintain a deployment checklist listing every required variable and where it lives; verify with a production smoke test after each secret change.       |
| Rollback cannot undo changed bindings or DB state                | Devil's advocate | Medium     | High   | Keep schema changes separate from app deploys; document manual rollback steps for Supabase and Cloudflare resource changes.                             |
| Preview deployments accidentally use production data             | Unknown unknowns | Medium     | High   | Configure separate preview secrets or read-only/test Supabase project before enabling public PR preview URLs.                                           |
| Free-tier CPU/request limits surprise the MVP                    | Research finding | Low        | Medium | Start on Free for validation, but budget the Workers Paid $5/month tier if SSR, AI orchestration, or traffic exceeds free limits.                       |

## Getting Started

1. Confirm the repo stays on the Workers path: keep `@astrojs/cloudflare` in `astro.config.mjs`, keep `wrangler.jsonc`, and do not switch to Cloudflare Pages for Astro SSR.
2. Authenticate Wrangler locally with `npx wrangler login`.
3. Add production secrets with `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`.
4. Run `npm run build`, then deploy with `npx wrangler deploy`.
5. After deployment, verify with the deployed URL and watch runtime logs with `npx wrangler tail 10x-astro-starter`.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
