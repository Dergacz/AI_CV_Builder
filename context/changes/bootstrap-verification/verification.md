---
bootstrapped_at: 2026-05-27T17:55:02Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: ai-cv-builder
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: ai-cv-builder
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

AI CV Builder is a 3-week after-hours web MVP with authenticated saved CVs, AI-assisted CV generation, PDF export, and lightweight English/Polish/Russian interface support. The recommended TypeScript-family starter for this product shape is 10x Astro Starter: Astro, React, TypeScript, Supabase, and Cloudflare provide an opinionated full-stack base with auth, database, storage, edge deployment, and explicit schemas already aligned. AI generation, PDF export, and i18n remain app-level implementation work, while payments, realtime, and background jobs stay out of scope for the MVP. GitHub Actions with auto-deploy-on-merge keeps the delivery path simple for a solo build.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | `cmd_template` starts with `git clone`; no `create-*` npm package was derivable |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed `2026-05-17T10:33:39Z` | fresh | from card `docs_url` |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 31392
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted after removing cloned `.git/`

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0
**Exit code**: 1 (informational; npm exits non-zero when vulnerabilities are present)

#### CRITICAL findings

None.

#### HIGH findings

- `devalue` (transitive): GHSA-77vg-94rm-hx3p, "Svelte devalue: DoS via sparse array deserialization"; affected range `5.6.3 - 5.8.0`; fix available.

#### MODERATE findings

- `@astrojs/check` (direct): via `@astrojs/language-server`; affected range `>=0.9.3`; fix available as `@astrojs/check@0.9.2` with semver-major impact.
- `@astrojs/language-server` (transitive): via `volar-service-yaml`; affected range `>=2.14.0`; affects `@astrojs/check`.
- `@cloudflare/vite-plugin` (transitive): via `miniflare`, `wrangler`, and `ws`; affected range `<=0.0.0-fff677e35 || 0.0.7 - 1.37.2`; fix available.
- `miniflare` (transitive): via `ws`; affected range `<=0.0.0-fff677e35 || 3.20250204.0 - 4.20260518.0`; affects `@cloudflare/vite-plugin` and `wrangler`; fix available.
- `volar-service-yaml` (transitive): via `yaml-language-server`; affected range `<=0.0.70`; affects `@astrojs/language-server`.
- `wrangler` (direct): via `miniflare`; affected range `<=0.0.0-kickoff-demo || 3.108.0 - 4.93.0`; affects `@cloudflare/vite-plugin`; fix available.
- `ws` (transitive): GHSA-58qx-3vcg-4xpx, "ws: Uninitialized memory disclosure"; affected range `8.0.0 - 8.20.0`; fix available.
- `yaml` (transitive): GHSA-48c2-rrv3-qjmp, "yaml is vulnerable to Stack Overflow via deeply nested YAML collections"; affected range `2.0.0 - 2.8.2`; affects `yaml-language-server`.
- `yaml-language-server` (transitive): via `yaml`; affected range `1.11.1-08d5f7b.0 - 1.21.1-f1f5a94.0 || 1.22.1-0ae5603.0 - 1.22.1-fc5f874.0`; affects `volar-service-yaml`.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | true |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance. The full breakdown is in this log.
