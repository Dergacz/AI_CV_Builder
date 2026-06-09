---
project: AI CV Builder
checked_at: 2026-06-09T10:11:00Z
health_status: needs-attention
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
  high: 1
  moderate: 11
  low: 0
test_runner_detected: true
ci_provider: GitHub Actions
recommended_fixes: 6
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

### Security Audit

```
Tool: npm audit --json
Summary: 0 CRITICAL, 1 HIGH, 11 MODERATE, 0 LOW
Direct vs transitive: the single HIGH and all 11 MODERATE findings are transitive
                      (build/dev tooling), not direct dependencies.
```

#### HIGH findings

- **devalue** 5.6.3–5.8.0 (transitive, via the Astro/Vite build toolchain) — DoS via
  sparse-array deserialization. Not on a runtime request path of this app; it ships in
  the build/SSR tooling. Fix: `npm audit fix` (bumps to a patched 5.x), then re-run
  `npm run test` + `npm run build` to confirm nothing broke.

#### MODERATE findings (11, advisory)

All transitive, concentrated in dev/build tooling — `@astrojs/check`,
`@astrojs/language-server`, `@cloudflare/vite-plugin`, `miniflare`, `qs`,
`typed-rest-client`, `volar-service-yaml`, `wrangler`, `ws`, `yaml`,
`yaml-language-server`. None are direct dependencies; most resolve as their parents
(Astro tooling, Wrangler) release patches. Fix: `npm audit fix`; review anything that
requires a major bump rather than forcing it.

### Outdated Dependencies

```
Packages with major version gaps: 0
```

No direct dependency is 2+ major versions behind. The project is, if anything, on the
leading edge (Astro 6, React 19, Tailwind 4, ESLint 9, zod 4, Vitest 4) — see the stack
assessment cross-reference for the idiom-drift implication.

## Test Suite

```
Test runner: Vitest 4.1.8
Tests found: 66 tests across 11 files
Test execution: passing (66/66 in ~289ms)
```

```
Configuration: vitest.config.ts (with @/* alias mirrored)
Framework: Vitest 4.1; mutation testing via Stryker (stryker.config.json, Vitest runner)
```

Strong test posture for a project at this stage: a fast unit/contract suite that runs in
under a second, plus a selective mutation-testing gate. The agent can verify its own
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
| Build      | ✓      | `npm run build` (Astro → Cloudflare adapter), with `npx astro sync`    |
| Type check | ~      | Partial — type-checked ESLint + `astro sync`, but no explicit `astro check` / `tsc --noEmit` gate |
| Security   | ✗      | No `npm audit` / Dependabot / CodeQL step in CI                        |

Both workflows run the full lint + test + build gate on Node 22; `deploy.yml` adds the
Cloudflare Workers deploy via `cloudflare/wrangler-action`. This is already a healthy
pipeline — better than most projects reach at this point.

## Configuration

### Low severity

- **.editorconfig** — missing. Cross-editor whitespace/indentation consistency. Prettier
  covers formatting on save/commit, so impact is minimal. Fix: add a small `.editorconfig`
  matching the Prettier settings.
- **.dev.vars.example** — missing. The project uses `.dev.vars` for Cloudflare local dev
  (per CLAUDE.md), but only `.env.example` documents the variables. A contributor running
  the Workers runtime locally has no template. Fix: add `.dev.vars.example` listing
  `SUPABASE_URL` / `SUPABASE_KEY` (and, for the upcoming work, the payment-provider and
  OpenAI keys) with placeholder values.

All high- and medium-severity configuration is present: `tsconfig.json` (strict via
`astro/tsconfigs/strict`), `eslint.config.js`, `.prettierrc.json`, `.gitignore`,
`.env.example`.

## Stack Assessment Cross-Reference

```
Stack assessment: context/foundation/stack-assessment.md
Agent readiness (from stack-assess): ready-with-compensation
```

| Quality Gate Gap                              | Health-Check Finding                                                                 | Status     |
|-----------------------------------------------|--------------------------------------------------------------------------------------|------------|
| Version-recency idiom drift (~ training data) | No CI `astro check`/`tsc` gate; the "Versions & idioms" block is still NOT in CLAUDE.md | Reinforced |
| Stale, self-contradicting AGENTS.md           | AGENTS.md test + migration sections were corrected this session — files now agree    | Mitigated  |
| Type safety (strength to preserve)            | Strict tsconfig + type-checked ESLint + tests present; CI type-check only partial     | Partially reinforced |

Notes:
- The stack assessment's **Gap 2** (stale AGENTS.md) is now resolved — the corrections were
  applied during this chain.
- The stack assessment's **Gap 1** (version-recency idioms) remains open: the recommended
  "Versions & idioms" block has not yet been added to `CLAUDE.md`. Health-check reinforces
  it: CI lacks an explicit type-check gate, so a stale-idiom build (e.g. a stray
  `tailwind.config.js`, a `.eslintrc`, zod-3 API usage) is more likely to slip through than
  it would with `astro check` wired in.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Patch the HIGH transitive advisory (devalue)

**Impact**: a known DoS advisory in the build/SSR toolchain; low real-world exposure here
but trivially fixable, and clean audits keep the agent from chasing phantom risk.
**Severity**: high (advisory) — transitive, build-tooling only
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm audit fix
npm run test && npm run build   # confirm the bump didn't break anything
```

### 2. Add an explicit type-check gate to CI

**Impact**: the stack's biggest strength is type safety, but CI doesn't fully enforce it —
type-checked ESLint catches a lot, yet a genuine type error in `.astro`/`.tsx` can still
build. An explicit gate makes the agent's type errors fail fast in CI, not in review.
**Severity**: medium
**Effort**: moderate (15–30 min)
**Fix**: add a check step to `ci.yml` (and `deploy.yml`) after `astro sync`:

```yaml
      - run: npx astro check
```

(`@astrojs/check` is already a dependency, so no install is needed.)

### 3. Add the "Versions & idioms" block to CLAUDE.md

**Impact**: this stack is newer than most training data; without pinned idioms the agent
will reach for previous-major patterns (`tailwind.config.js`, `.eslintrc`, manual
memoization, zod-3 APIs) that break the build or fight the toolchain. This is the stack
assessment's still-open Gap 1.
**Severity**: medium
**Effort**: quick (< 5 min) — the block is ready-to-paste in `stack-assessment.md`
**Fix**: paste the "Versions & idioms (pinned)" block from
`context/foundation/stack-assessment.md` into `CLAUDE.md`.

### 4. Review/patch the 11 MODERATE advisories

**Impact**: advisory only (all transitive dev/build tooling), but worth a pass so the audit
baseline is clean and future real findings stand out.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm audit          # read the advisories
npm audit fix      # apply non-breaking patches; do not force major bumps
```

### 5. Add a `.dev.vars.example` template

**Impact**: contributors (and the agent) running the Cloudflare Workers runtime locally
have no template for `.dev.vars`; the upcoming release adds new secrets (payment provider,
OpenAI) that need documenting somewhere discoverable.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: create `.dev.vars.example` with placeholder keys (`SUPABASE_URL=`, `SUPABASE_KEY=`,
and the new keys as they land), mirroring `.env.example`.

### 6. Add an `.editorconfig`

**Impact**: minor consistency convenience; Prettier already covers most of it.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**: add a minimal `.editorconfig` (UTF-8, LF, final newline, 2-space indent) matching
`.prettierrc.json`.

### Addressed in upcoming lessons (Category B)

Unusually for a brownfield project at this stage, the typical Category B gaps are **already
satisfied** — there is nothing to defer:

- **CI/CD pipeline** — already present (`ci.yml` + `deploy.yml`, full lint/test/build gate
  plus Cloudflare deploy).
- **Agent instruction files** — `CLAUDE.md` and `AGENTS.md` both exist (and AGENTS.md was
  corrected this session).
- **Deployment configuration** — present (`wrangler.jsonc`, `@astrojs/cloudflare`,
  `deploy.yml`).

## Summary

```
Health status: needs-attention
```

This is a fundamentally healthy, agent-ready project — strict TypeScript, a fast green test
suite (66/66) plus mutation testing, a real CI + deploy pipeline, and current instruction
files. The "needs-attention" verdict is driven by light, mostly one-command items: a single
HIGH transitive advisory (`npm audit fix`), no explicit type-check gate in CI, and the
still-open version-idioms compensation from the stack assessment. None are blockers; all are
quick-to-moderate. The Category B gaps that usually slow brownfield projects (CI, deploy,
agent docs) are already in place.

Next step: knock out fixes 1–3 (audit patch, CI `astro check`, paste the Versions & idioms
block) — together ~30 minutes — then proceed to agent onboarding. The foundation artifacts
(prd-v2.md, stack-assessment.md, this report) give an agent full context for the
commercial-readiness release.
