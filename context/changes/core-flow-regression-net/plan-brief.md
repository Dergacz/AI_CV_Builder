# Core-Flow Regression Net — Plan Brief

> Full plan: `context/changes/core-flow-regression-net/plan.md`

## What & Why

Build a minimal regression net that locks in the current behavior of the core flow — questionnaire → AI generation → section editing → save → PDF export → reopen — at the exact seams the upcoming launch-safety gates (email verification, consent gate, Google auth, daily-generation limit) will touch. The net exists so those gates **cannot silently break the working flow** (roadmap F-02, PRD FR-013). It is a characterization net over the existing path only — not a general test-suite rewrite.

## Starting Point

The flow already works and has solid coverage at the edges (schemas, message mappers, filename/language-boundary contracts) plus a happy-path E2E (`seed.spec.ts`, `cv-persistence.spec.ts`). Four gaps remain where a future gate could regress behavior undetected: the **generation service** (today fully mocked away), the **save failure envelope** (only the 413 body-size guard is tested), **PDF output quality** (zero render coverage despite being an explicit F-02 goal), and a **full-path reachability** check for a verified user.

## Desired End State

`npm test` and `npm run test:e2e` cover all four gaps, and each new test is **proven to fail when the behavior it guards breaks** (break-to-prove-red, then reverted, recorded in a comment). A future gate PR that over-blocks a legitimate user or perturbs the generation/save/export seams turns the net red instead of shipping a silent regression.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Coverage boundary | Full happy-path + gate seams | Maximal protection per test without drifting into the suite-rewrite the roadmap excludes | Plan |
| PDF quality depth | Render-tree + bytes characterization (unit) | Deterministic content/glyph coverage without browser flake; bytes smoke proves a real PDF | Plan |
| Generation service | Characterize with a mocked provider | Locks the contract the daily-limit gate sits on, no real API calls | Plan |
| Gate-seam contract | E2E reachability for a normal verified user | Turns "gates can't break the flow" into a runnable check | Plan |
| Failure modes | Lock generation + save failure contracts (unit) | Gate-introduced error shapes (e.g. daily-limit) can't silently break failure UX | Plan |
| Section editing | Fold one edit into the happy-path E2E | Proves edit→save→persist in the real flow with minimal new surface | Plan |
| Definition of "guarded" | Break-to-prove-red on key assertions | A test that never fails proves nothing for a safety net | Plan |

## Scope

**In scope:** generation-service contract (unit), save-failure-envelope contract (unit), PDF output-quality characterization (unit), one full-path core-flow E2E (with section edit + PDF download), break-to-prove-red verification per phase.

**Out of scope:** general test-suite rewrite, real OpenAI calls, a separate E2E error-state spec, pixel/visual PDF diffing, changes to the gates themselves, CI workflow changes.

## Architecture / Approach

Three fast, deterministic node-environment unit phases (generation → save → PDF, ordered by gate blast radius) followed by one E2E phase that folds section-editing and PDF-download into a single full-path spec. Generation is characterized with global `fetch` stubbed; the E2E keeps the existing `/api/cv/generate` mock seam and `storageState` verified account. Every phase applies break-to-prove-red as its definition of done.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Generation service contract | `generateCvDraft` happy + all failure buckets + prompt/privacy (unit) | Mock must mirror OpenAI structured-output shape |
| 2. Save seam failure contract | Save route auth/validation/not-found/persistence envelopes (unit) | Avoiding duplication with existing `cv-save` tests |
| 3. PDF output-quality characterization | Render-tree content/headings/empty-states + valid-bytes smoke (unit) | Module-level `Font.register` points at browser path — unresolvable in node |
| 4. Core-flow happy-path + reachability E2E | Full path: questionnaire→generate→edit→save→reopen→export | E2E flake on the real PDF download; verified-user setup must survive a future verification gate |

**Prerequisites:** local Supabase (`npm run db:start`) for the E2E phase; none for the unit phases. Vitest + Playwright infra already exists.
**Estimated effort:** ~1–2 sessions across 4 phases (3 unit + 1 E2E).

## Open Risks & Assumptions

- The bytes-level PDF smoke depends on re-registering Noto Sans from `public/fonts/` in the test, since the module-level `Font.register` uses the unresolvable `/fonts/...` browser path — render-tree assertions (font-free) carry the bulk of content coverage as the mitigation.
- Vitest runs in node with no jsdom/testing-library, so PDF content is asserted by walking the returned React element tree, not via a DOM renderer.
- The E2E must run under the existing verified `storageState` account so a future email-verification gate doesn't break the net's own setup.

## Success Criteria (Summary)

- A verified user can still complete the entire funnel end-to-end, proven by a single runnable E2E that goes red if any step regresses.
- The generation, save, and PDF seams each have a unit contract that fails when its protected behavior breaks (verified, not just green).
- The net is additive and test-only — no production-source or schema changes.
