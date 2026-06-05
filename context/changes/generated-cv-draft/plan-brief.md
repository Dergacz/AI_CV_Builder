# Generated CV Draft — Plan Brief

> Full plan: `context/changes/generated-cv-draft/plan.md`

## What & Why

Roadmap slice S-04: turn the captured guided-questionnaire answers into a usable, structured `GeneratedCvDraft` via an AI call. This is the slice that proves the core product promise — that everyday-language answers can become a professional structured CV draft. The user generates from the existing `/cv/new` review step and sees the result, with honest loading and clear failure states (FR-006, FR-012, FR-013, FR-014).

## Starting Point

S-03 is done: a protected `/cv/new` guided questionnaire ends at a read-only review whose primary action is intentionally disabled ("Generation comes next"). The typed input contract (`CvQuestionnaireAnswers`, `QUESTIONNAIRE_VERSION`) exists, and F-01 fully specifies the output (`GeneratedCvDraft` shape, error buckets, <30s timeout, anti-fabrication rules) with a reference fixture. The repo has **no AI SDK, no AI secret, and no zod** yet.

## Desired End State

A signed-in user presses **Generate draft** on review, sees a spinner with honest status, and lands on a minimal readable preview of the draft (all five sections + assumptions/warnings), clearly labelled as a draft with the clean template + editing noted as coming next. Failures show a plain bucketed message with a **Retry** that preserves answers. The draft is in-memory only — no save, no export, no editing template.

## Key Decisions Made

| Decision                              | Choice                                                                       | Why (1 sentence)                                                   | Source       |
| ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------ |
| Output contract / shape               | Reuse F-01 `GeneratedCvDraft` verbatim                                       | Already settled and fixture-backed; S-04 just implements it        | Frame (F-01) |
| Error buckets, timeout, minimal-input | Reuse F-01 (`generation_failed`/`service_unavailable`, <30s, no fabrication) | Contract decisions belong to F-01                                  | Frame (F-01) |
| AI provider                           | OpenAI with strict structured outputs (`json_schema`)                        | Hardest guarantee of schema conformance; fetch-based, Workers-safe | Plan         |
| JSON enforcement                      | Native structured output **+** server-side zod validation                    | Defense-in-depth; invalid → `generation_failed`                    | Plan         |
| Draft display                         | Inline in the `/cv/new` island, in-memory                                    | No persistence in S-04; matches S-03's client-island pattern       | Plan         |
| Preview fidelity                      | Minimal readable preview, no editing                                         | Avoids stealing S-05's template/editing scope                      | Plan         |
| Loading UX                            | Simple spinner + honest status text                                          | Satisfies FR-013 without fake progress (F-01)                      | Plan         |
| Error + retry                         | Bucket message + manual Retry, answers preserved                             | F-01 says retry is the MVP recovery; no surprise re-billing        | Plan         |
| No-key behavior                       | Return `service_unavailable`                                                 | Mirrors Supabase `null`-when-unconfigured pattern                  | Plan         |
| Testing                               | Repo gates + manual, no new runner                                           | Consistent with S-03; keeps the 3-week MVP moving                  | Plan         |

## Scope

**In scope:** OpenAI generation service (prompt, strict structured output, timeout, validation, bucket mapping); authenticated `POST /api/cv/generate` JSON route; `GeneratedCvDraft` type + zod schema + `OPENAI_API_KEY` config; questionnaire UI wiring (generate, loading, minimal preview, error/retry).

**Out of scope:** CV persistence / saved-CV library (S-06), clean template + section editing (S-05), PDF export (S-07), UI i18n switcher (S-08), background jobs/streaming, per-section regeneration, new test runner, roadmap/tracker status flips.

## Architecture / Approach

Back-to-front in four phases. Lock the contract in code (zod schema + shared type + secret) → implement the service (`src/lib/services/cv-generation.ts`) behind a JSON route (`src/pages/api/cv/generate.ts`, auth-gated, zod-validated input) → wire the existing `QuestionnaireFlow.tsx` island to call it (loading, preview, retry) → verify. Reliability rests on enforcing the schema twice: OpenAI `json_schema` strict mode constrains the model, and a server-side zod parse guarantees it before returning. Single synchronous request on Cloudflare Workers via `fetch` + `AbortController`; no raw-answer logging (F-02).

## Phases at a Glance

| Phase                               | What it delivers                                                                   | Key risk                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Contract & validation foundation | `zod`, `GeneratedCvDraft` type, zod schema, response type, `OPENAI_API_KEY` config | Schema drifting from the F-01 contract                             |
| 2. Service & API route              | OpenAI generation logic + auth-gated JSON endpoint                                 | Workers runtime/SDK compat; model schema conformance; timeout/cost |
| 3. Questionnaire generation UI      | Generate action, loading, minimal preview, error/retry                             | Scope creep into S-05 template/editing                             |
| 4. Verification & change metadata   | Repo gates, scope guards, metadata update                                          | Silent persistence/PDF/editing leakage                             |

**Prerequisites:** F-01 (done) and S-03 (done); an OpenAI API key for end-to-end manual testing (absence degrades to `service_unavailable`).
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- AI output reliability: even with strict structured outputs, the model could miss the schema — zod validation catches it and maps to `generation_failed`; sparse-input honesty depends heavily on the system prompt.
- Workers runtime: the OpenAI path must be `fetch`-based; a Node-only SDK would not run.
- Timing: generation must stay comfortably under 30s; the `AbortController` budget (~25s) bounds the worst case.
- Provider lock-in: model name is configurable, but the API shape ties us to OpenAI for this slice.

## Success Criteria (Summary)

- A signed-in user generates a schema-valid `GeneratedCvDraft` (all five sections) in the selected language and sees a readable draft preview.
- Sparse input produces warnings, not fabricated facts; failures show the correct bucket with answer-preserving retry.
- `npm run lint` + `npm run build` pass, and scope guards confirm no persistence, PDF, editing template, or raw-answer logging was added.
