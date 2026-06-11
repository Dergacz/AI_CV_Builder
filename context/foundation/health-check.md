---
project: AI CV Builder
checked_at: 2026-06-11T11:12:18Z
health_status: healthy
context_type: brownfield
language_family: js
stack_assessment_available: true
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 7
  low: 0
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 4
---

> Supersedes the 2026-06-09 report (which was `needs-attention`). Several items it flagged
> have since been fixed: the HIGH `devalue` advisory is gone (now 0 high), moderate advisories
> dropped 11 → 7, CI now runs `npx astro check` (the explicit type-check gate that report
> wanted), and `CLAUDE.md` now carries the "Versions & idioms (pinned)" block. The remaining
> items are all low-severity.

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

### Security Audit

```
Tool: npm audit --json
Summary: 0 CRITICAL, 0 HIGH, 7 MODERATE, 0 LOW
Direct vs transitive: 1 direct (@astrojs/check), 6 transitive — all in the
                      type-check / dev tooling chain, not the production runtime.
```

#### MODERATE findings (7, advisory)

All seven chain from a single dev-only root — `@astrojs/check` (the type-checking tool behind
`npm run typecheck` / CI `astro check`) → `@astrojs/language-server` → `volar-service-yaml` →
`yaml-language-server` → `yaml` (Stack Overflow via deeply nested YAML), plus `qs` /
`typed-rest-client` (a remotely-triggerable `qs.stringify` DoS). None sits on a production
request path — they ship in the editor/type-check toolchain. Fix: `npm audit fix` (apply
non-breaking patches as the Astro tooling releases them); do not force a major bump of
`@astrojs/check`.

### Outdated Dependencies

```
Packages with major version gaps: 4 (all exactly 1 major behind; deliberate pins)
```

- **eslint**: 9.39.4 → 10.4.1 (1 major behind)
- **@eslint/js**: 9.39.4 → 10.0.1 (1 major behind)
- **typescript**: 5.9.3 → 6.0.3 (1 major behind)
- **lint-staged**: 16.4.0 → 17.0.7 (1 major behind)

Informational only. The project deliberately pins these majors (ESLint 9 flat config, TS 5.9)
per `CLAUDE.md`, and the React-Compiler / typescript-eslint plugin chain is sensitive to ESLint
and TS majors — do **not** bump these blindly. No direct dependency is 2+ majors behind.

## Test Suite

```
Test runner: Vitest 4 (unit) + Playwright 1.60 (E2E)
Tests found: 76 unit tests across 14 files; 3 Playwright E2E specs
Test execution: collects cleanly (vitest list enumerates all 76); run green in CI
```

```
Configuration: vitest.config.ts (with @/* alias mirrored); playwright.config.ts; e2e/
Framework: Vitest 4 + Playwright 1.60; mutation testing via Stryker (stryker.config.json, Vitest runner)
```

Strong, growing test posture (up from 66/11 at the last check): a fast unit/contract suite,
Playwright E2E specs, and a selective mutation-testing gate. The agent can verify its own
changes locally and in CI.

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml (PRs to master) + .github/workflows/deploy.yml (push to master → Cloudflare Workers)
```

| Stage      | Status | Notes                                                                 |
|------------|--------|-----------------------------------------------------------------------|
| Lint       | ✓      | `npm run lint` (ESLint 9, type-checked rules via typescript-eslint)    |
| Test       | ✓      | `npm run test` (Vitest) — matches the detected runner                  |
| Build      | ✓      | `npm run build` (Astro → Cloudflare adapter), after `npx astro sync`   |
| Type check | ✓      | `npx astro check` now runs in CI (added since the last report)         |
| Security   | ✗      | No `npm audit` / Dependabot / CodeQL step in CI                        |

E2E note: the Playwright suite (`test:e2e`) is **not** wired into CI — it runs locally only.
Both gaps (security scan, E2E-in-CI) are CI-hardening items, not blockers (see Category B).
This is already a healthy pipeline — type-check + lint + test + build on Node 22, plus a
Cloudflare Workers deploy in `deploy.yml`.

## Configuration

### Low severity

- **.editorconfig** — missing. Cross-editor whitespace/indentation consistency. Prettier
  covers formatting on save/commit, so impact is minimal. Fix: add a small `.editorconfig`
  (UTF-8, LF, final newline, 2-space indent) matching `.prettierrc.json`.
- **.dev.vars.example** — missing. The project uses `.dev.vars` for Cloudflare local dev (per
  CLAUDE.md), but only `.env.example` documents variables. A contributor/agent running the
  Workers runtime locally has no template — and the launch-readiness work adds new keys
  (analytics, error monitoring, transactional email). Fix: add `.dev.vars.example` mirroring
  `.env.example` with the new keys as placeholders.

All high- and medium-severity configuration is present: `tsconfig.json` (strict via
`astro/tsconfigs/strict`), `eslint.config.js`, `.prettierrc.json`, `.gitignore`,
`.env.example`, `.nvmrc`.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready-with-compensation
```

| Quality Gate Gap (from stack-assess)          | Health-Check Finding                                                              | Status     |
|-----------------------------------------------|----------------------------------------------------------------------------------|------------|
| Version-recency idiom drift (~ training data) | CLAUDE.md now carries the "Versions & idioms" block AND CI runs `astro check`     | Mitigated  |
| AGENTS.md scope pointer lags the PRD          | AGENTS.md still references `prd.md` (greenfield v1) + old MVP hard-rules          | Reinforced |
| Type safety (strength to preserve)            | Strict tsconfig + type-checked ESLint + explicit CI `astro check` + 76 tests      | Mitigated  |

Notes:
- The stack assessment's version-recency compensation is now **doubly covered** — the pinned
  idioms live in `CLAUDE.md` and CI enforces types via `astro check`, so a stale-idiom build
  (a stray `tailwind.config.js`, a `.eslintrc`, zod-3 API usage) is far more likely to fail
  fast than slip through.
- The one open stack-assess item — `AGENTS.md` still pointing at the greenfield `prd.md` and
  framing hard-rules around the old MVP — is an instruction-file currency fix; the
  ready-to-paste replacement is in `stack-assessment.md`. Surfaced under Category B (agent
  onboarding) below.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Update the AGENTS.md scope pointer to the brownfield PRD

**Impact**: `AGENTS.md` still points at `@context/foundation/prd.md` (greenfield v1) and its
hard-rules say "no billing... unless the PRD changes." The PRD *has* changed — `prd-v3.md` is
the active launch-readiness scope. An agent reading the stale pointer will mis-scope what's
in/out of bounds.
**Severity**: medium
**Effort**: quick (< 5 min) — the ready-to-paste replacement is in `stack-assessment.md`
**Fix**: replace the `prd.md` reference + MVP hard-rules in `AGENTS.md` with the
launch-readiness scope block from `context/foundation/stack-assessment.md`.

### 2. Review/patch the 7 MODERATE advisories

**Impact**: advisory only (all in the dev/type-check toolchain, not the runtime), but a clean
audit baseline means future *real* findings stand out instead of hiding in noise.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm audit          # read the @astrojs/check → yaml/qs chain
npm audit fix      # apply non-breaking patches; do NOT force a @astrojs/check major bump
```

### 3. Add a `.dev.vars.example` template

**Impact**: contributors and the agent running the Cloudflare Workers runtime locally have no
template for `.dev.vars`; the launch-readiness work adds new secrets (analytics, error
monitoring, transactional email) that need documenting somewhere discoverable.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: create `.dev.vars.example` mirroring `.env.example` (`SUPABASE_URL=`, `SUPABASE_KEY=`,
plus the new keys as placeholders).

### 4. Add an `.editorconfig`

**Impact**: minor consistency convenience; Prettier already covers most of it.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: add a minimal `.editorconfig` (UTF-8, LF, final newline, 2-space indent) matching
`.prettierrc.json`.

### Addressed in upcoming lessons (Category B)

The CI/deploy/instruction-file gaps that usually slow brownfield projects are largely already
in place; what remains is CI hardening:

### Security scanning in CI

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: add a security stage to CI (Dependabot, CodeQL, or an `npm audit`
step) so dependency advisories are caught automatically rather than on manual audit.

### E2E (Playwright) in CI

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: wire the existing Playwright suite into CI so browser-level
regressions (the launch-readiness verification wall, consent gate, account deletion) are caught
before merge — the guardrail FR-013 asks for exactly this.

> Note: the usual Category B items — CI/CD pipeline, agent instruction files, deployment config
> — are **already satisfied** (`ci.yml` + `deploy.yml`, `CLAUDE.md` + `AGENTS.md`,
> `wrangler.jsonc` + `@astrojs/cloudflare`). Only the two CI-hardening items above remain.

## Summary

```
Health status: healthy
```

This is a clean, agent-ready project: 0 critical / 0 high dependency advisories, strict
TypeScript with an explicit CI type-check gate, a growing green test suite (76 unit tests +
Playwright E2E + Stryker mutation testing), a full lint/test/build CI plus a Cloudflare deploy
pipeline, and current instruction files with the pinned-version idioms in place. The only open
items are light: 7 dev-toolchain moderate advisories, two missing low-severity config templates,
and a stale `AGENTS.md` scope pointer — all quick fixes, none blocking.

Next step: do the four quick Category A fixes (most impactful: point `AGENTS.md` at `prd-v3.md`
so the agent scopes the launch-readiness work correctly) — together ~15 minutes — then proceed
to agent onboarding and implementation. The foundation artifacts (`prd-v3.md`,
`stack-assessment.md`, this report) give an agent full context for the launch-readiness release.
