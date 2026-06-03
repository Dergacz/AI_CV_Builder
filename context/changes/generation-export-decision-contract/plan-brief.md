# Generation Export Decision Contract - Plan Brief

> Full plan: `context/changes/generation-export-decision-contract/plan.md`

## What & Why

This plan defines the minimal generation and PDF export contract for AI CV Builder. F-01 exists because generated draft, section editing, PDF export, and the full saved PDF flow would otherwise make incompatible assumptions about CV shape, runtime behavior, errors, and export quality.

## Starting Point

The app is an Astro 6 SSR app on Cloudflare Workers with Supabase auth and existing deployment config. Product generation, CV persistence, PDF export, AI SDKs, schema validators, and PDF dependencies do not exist yet.

## Desired End State

Future slices can rely on one contract artifact for the structured CV draft shape, minimal-input behavior, error buckets, timeout boundary, PDF export recommendation, and validation criteria. The change also provides one representative JSON fixture and a PDF runtime spike record so later planning does not need to rediscover the same decisions.

## Key Decisions Made

| Decision          | Choice                                                   | Why                                                                                        |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Scope             | Contract plus small spike                                | This resolves the blocker while validating the highest-risk runtime assumption.            |
| Generation shape  | Strict structured JSON sections                          | Section editing and PDF export need predictable fields, not markdown or HTML parsing.      |
| Minimal input     | Usable but honest draft                                  | The PRD requires usefulness without inventing facts that would damage trust.               |
| PDF path          | Validate Workers/browser-compatible renderer first       | Cloudflare Workers compatibility is the main export risk.                                  |
| Timeout           | Typical generation under 30s with hard failure and retry | This matches the PRD response-timing guardrail.                                            |
| Errors            | Three user-facing buckets                                | `generation_failed`, `export_failed`, and `service_unavailable` keep MVP messaging simple. |
| Verification      | Docs, fixture, build gates, runtime spike result         | Later slices need both a contract and evidence, not only prose.                            |
| Artifact location | Change folder                                            | Keeps the decision durable without adding premature source APIs.                           |

## Scope

**In scope:**

- `decision-contract.md` for generation, export, timeout, error, and handoff decisions.
- `cv-contract.fixture.json` as a representative generated CV draft.
- `pdf-runtime-spike.md` with compatibility evidence and a recommendation.
- Verification through JSON parsing, Prettier checks, `npx astro sync`, `npm run lint`, and `npm run build`.

**Out of scope:**

- Generated CV draft implementation.
- Editable template implementation.
- Final PDF export UI or route.
- CV persistence, migrations, background jobs, multiple templates, uploads, billing, cover letters, job tailoring, or deep localization.

## Architecture / Approach

Keep the contract in `context/changes/generation-export-decision-contract/` until downstream slices are ready to create source-level types, routes, and UI. The canonical generated CV draft is strict JSON with editable sections for Summary, Experience, Education, Skills, and Languages; PDF export starts with a validated Workers/browser-compatible path and uses an external service only if that path fails.

## Phases at a Glance

| Phase                        | What it delivers                                             | Key risk                                                    |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| 1. Contract Artifact         | Written decision contract for generation/export behavior     | Accidentally designing implementation instead of a contract |
| 2. Fixture And Runtime Spike | Representative fixture plus PDF compatibility recommendation | Spike evidence is too weak to unblock S-07                  |
| 3. Verification And Handoff  | Repo gates and downstream handoff notes                      | Future slices still have to re-ask F-01 questions           |

**Prerequisites:** Existing roadmap, PRD, infrastructure notes, and current Cloudflare Workers config.
**Estimated effort:** About 1 implementation session across 3 small phases.

## Open Risks & Assumptions

- The recommended PDF path may still fail under real deployed Workers/browser conditions and trigger the fallback rule.
- The exact AI provider is intentionally not chosen here; future generation planning must map its SDK to this contract.
- Persistence shape is intentionally deferred to `cv-persistence-privacy-contract`.

## Success Criteria (Summary)

- Future S-04 planning can reuse the generation contract without re-asking the F-01 output-shape question.
- Future S-07 planning can reuse the PDF recommendation, validation evidence, and fallback trigger.
- The change remains a foundation decision artifact and does not grow into the generation/export implementation.
