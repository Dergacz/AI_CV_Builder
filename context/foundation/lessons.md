# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Bound every side of a provider call, not just its duration

- **Context**: `src/lib/services/cv-generation.ts:234` — the OpenAI request in `generateCvDraft`.
- **Problem**: The service bounds how long it waits (`GENERATION_TIMEOUT_MS` + `AbortController`), but nothing bounds how much comes back: no output token cap, and `DRAFT_CONTENT_JSON_SCHEMA` leaves every array and string unbounded. A verbose response is therefore free to grow until the timeout, driving latency, cost, and parse work on a Worker with finite CPU time.
- **Rule**: A provider call needs a limit on each axis it can grow along — time, input size, and output size. A timeout alone is not a budget. Set an explicit output cap on the request, and give the model-facing schema concrete `maxItems`/`maxLength` where the domain has an obvious ceiling (a CV has a handful of roles, not hundreds). Where OpenAI strict mode rejects the constraint, enforce it in the zod schema that re-validates the response instead, so the bound still exists somewhere.
- **Applies to**: every outbound model or third-party API call in `src/lib/services/`. Inbound request bodies already follow this rule via `readBoundedJson` (`src/lib/request-body.ts`); the outbound direction should match.

## A file's directory can be an implicit deployment decision

- **Context**: `src/pages/api/cv/index.test.ts` — a unit test colocated with the route it tested.
- **Problem**: Astro turns every module under `src/pages/` into a route, so the test shipped as a public endpoint (`/api/cv/index.test`) and pulled `vitest` into the deployed Cloudflare Worker bundle. Nothing failed: lint, tests, and build were all green while dev-only code sat in production.
- **Rule**: In convention-driven frameworks, placing a file inside a magic directory is a deployment decision, not an organizational one. Before colocating a non-shipping file (test, fixture, script, scratch module) next to shipping code, check whether the framework claims that directory — and when a rule like this is discovered, encode it as a test rather than a comment, because the failure mode is silent. See `src/tests/no-tests-under-pages.test.ts` and R-09 in `context/foundation/test-plan.md`.
- **Applies to**: `src/pages/**` above all; more broadly any framework-owned directory (route trees, migration folders, plugin/auto-import roots).
