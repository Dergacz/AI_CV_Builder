# Generation Export Decision Contract Implementation Plan

## Overview

Define the minimal generation and PDF export contracts that unblock the generated CV draft, template editing, PDF export, and full saved PDF flow. This change produces durable planning artifacts only: a decision contract, a representative fixture, and a small PDF runtime spike record.

## Current State Analysis

The roadmap marks `generation-export-decision-contract` as F-01: a foundation slice whose outcome is deciding generation output, PDF export behavior, timeout/error boundaries, and verification criteria before S-04, S-07, and S-08 are planned. The app currently has Astro SSR, auth, Supabase env handling, and Cloudflare Workers deployment, but no CV generation, CV persistence, PDF export route, AI SDK, schema validator, or PDF dependency.

Cloudflare Workers is the deployment runtime. The existing infrastructure research calls out PDF and AI packages as high-risk because many assume Node APIs, Chromium, filesystem access, native binaries, long-lived processes, or long request paths. Context7 checks against current Astro, Cloudflare Workers, and React PDF docs confirmed that Astro Cloudflare routes are server-rendered on Workers, Cloudflare package compatibility remains package-dependent even with `nodejs_compat`, and React PDF has separate browser APIs and Node-specific server rendering APIs.

## Desired End State

After this plan is implemented, future slices can reference one contract artifact for:

- the canonical structured CV draft shape that generation must return,
- how minimal or incomplete user input must be handled without inventing facts,
- the initial PDF export path and fallback rule,
- the timeout and user-facing error boundaries,
- the fixture and verification criteria that S-04 and S-07 must satisfy.

Verification succeeds when the contract artifacts exist, the fixture is valid JSON, the PDF runtime spike has an explicit pass/fail recommendation, and the current repo gates still pass.

### Key Discoveries:

- F-01 is explicitly a foundation contract that unlocks S-04, S-07, and S-08: `context/foundation/roadmap.md:67`.
- Generated output must support Summary, Experience, Education, Skills, and Languages, and PDF export is core MVP scope: `context/foundation/prd.md:66`.
- Typical generation should complete under 30 seconds and major generation/export failures need clear user-facing states: `context/foundation/prd.md:80`.
- Cloudflare Workers compatibility is the highest-risk export constraint: `context/foundation/infrastructure.md:62`.
- The current app has no AI/PDF/schema dependencies yet: `package.json:14`.
- API and auth conventions already exist through uppercase `APIRoute` handlers, middleware-populated `context.locals.user`, and `createClient()` for Supabase sessions: `src/pages/api/auth/signin.ts:1`, `src/middleware.ts:6`, `src/lib/supabase.ts:5`.

## What We're NOT Doing

- Building the generated CV draft feature.
- Building the editable CV template.
- Building the final PDF export UI.
- Adding saved CV persistence or database migrations.
- Adding background jobs, queues, a separate Worker service, or a generic orchestration layer.
- Adding old CV uploads, multiple templates, per-section AI regeneration, job-description tailoring, cover letters, billing, or deep localization.
- Choosing a provider-specific AI SDK unless the PDF/runtime spike forces a minimal compatibility note.

## Implementation Approach

Keep this as a foundation contract with one narrow runtime spike. The contract lives inside `context/changes/generation-export-decision-contract/` so it does not prematurely create source-level APIs before the generated draft and PDF export slices exist.

The default generation output is a strict structured JSON draft with section arrays and metadata. The default minimal-input behavior is a useful but honest draft that preserves missing-information boundaries instead of inventing facts. The export approach is validated before a final dependency choice: prefer a browser/client PDF path for the MVP unless the spike proves a Workers-compatible server-side route is safer within the same scope. External PDF services remain a fallback only if Workers/browser-compatible options fail.

## Critical Implementation Details

### Runtime Compatibility

Do not treat local Node PDF generation as proof that the MVP export path works on Cloudflare Workers. The spike must distinguish browser-side PDF APIs from Node-only server rendering APIs and record what is safe to use in a Workers-deployed Astro app.

### Contract Lineage

The contract should explicitly say which later slices consume each decision: S-04 consumes the generation shape and timeout boundaries, S-05 consumes the section editability assumptions, S-07 consumes the PDF export path and verification criteria, and S-08 consumes language/output constraints.

## Phase 1: Contract Artifact

### Overview

Create the durable decision contract that answers the roadmap unknowns and fixes the shape future implementation slices will consume.

### Changes Required:

#### 1. Generation and export decision contract

**File**: `context/changes/generation-export-decision-contract/decision-contract.md`

**Intent**: Define the minimal structured CV contract, generation behavior, PDF export behavior, timeout/error boundaries, and handoff rules for future slices.

**Contract**: The document must include sections for:

- `GeneratedCvDraft` top-level shape with `schemaVersion`, `language`, `source`, `sections`, `assumptions`, and `warnings`.
- Editable sections: `summary`, `experience[]`, `education[]`, `skills[]`, and `languages[]`.
- Required versus optional fields for each editable section.
- Rules for minimal input: preserve truth, mark unknowns, avoid invented employers, dates, schools, languages, certifications, and achievements.
- Error buckets: `generation_failed`, `export_failed`, and `service_unavailable`.
- Timeout boundary: typical generation target under 30 seconds, with a hard failure path and retry affordance.
- PDF export decision: validate a Workers/browser-compatible path first; external service only as fallback.
- Verification criteria consumed by S-04, S-05, S-07, and S-08.

### Success Criteria:

#### Automated Verification:

- Contract artifact exists at `context/changes/generation-export-decision-contract/decision-contract.md`.
- Contract artifact passes Prettier check with `npx prettier --check context/changes/generation-export-decision-contract/decision-contract.md`.
- Contract artifact contains the required decision headings for generation shape, minimal-input behavior, PDF export path, errors, timeouts, and downstream handoff.

#### Manual Verification:

- Contract answers both F-01 roadmap unknowns without introducing source implementation.
- Contract stays inside PRD scope and does not add uploads, multiple templates, document editing, billing, cover letters, or deep localization.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the contract scope is right before proceeding to the fixture and spike phase.

---

## Phase 2: Fixture And Runtime Spike

### Overview

Add one representative fixture and a focused spike record that proves or rejects the initial PDF export assumption before later slices depend on it.

### Changes Required:

#### 1. Representative generated CV fixture

**File**: `context/changes/generation-export-decision-contract/cv-contract.fixture.json`

**Intent**: Provide a concrete example of the structured CV draft that future generation, editing, persistence, and export slices can use as a shared test input.

**Contract**: The JSON fixture must follow the shape defined in `decision-contract.md`, include all five editable sections, include at least one missing-information warning, and avoid personal secrets or real private user data.

#### 2. PDF runtime spike record

**File**: `context/changes/generation-export-decision-contract/pdf-runtime-spike.md`

**Intent**: Record the PDF export compatibility evidence and recommendation without building the final export feature.

**Contract**: The spike record must include:

- candidates considered,
- whether each candidate is browser-side, Workers-side, Node-only, or external service,
- what was validated locally,
- what remains to validate in a deployed Worker or preview,
- the recommended MVP path,
- fallback trigger for switching to an external service.

#### 3. Optional spike helper

**File**: `context/changes/generation-export-decision-contract/spike-notes/`

**Intent**: Keep any one-off spike notes or throwaway command output near the contract without putting experimental code in `src`.

**Contract**: Use this folder only if the spike needs supporting notes. Do not add production source files, routes, or app dependencies unless the spike cannot be evaluated without them.

### Success Criteria:

#### Automated Verification:

- Fixture file exists at `context/changes/generation-export-decision-contract/cv-contract.fixture.json`.
- Fixture parses as JSON with `node -e "JSON.parse(require('node:fs').readFileSync('context/changes/generation-export-decision-contract/cv-contract.fixture.json','utf8'))"`.
- Spike record exists at `context/changes/generation-export-decision-contract/pdf-runtime-spike.md`.
- Changed markdown and JSON artifacts pass Prettier check with `npx prettier --check context/changes/generation-export-decision-contract`.

#### Manual Verification:

- Fixture is realistic enough for a first-time job seeker or career changer and exercises every editable section.
- Spike record makes a clear PDF recommendation and names what would force the fallback path.
- Spike does not commit the team to a full export implementation before S-07.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the fixture and spike evidence are useful enough for downstream planning.

---

## Phase 3: Verification And Handoff

### Overview

Validate the artifacts, update handoff status, and make the contract ready for later roadmap slices.

### Changes Required:

#### 1. Contract handoff notes

**File**: `context/changes/generation-export-decision-contract/decision-contract.md`

**Intent**: Add final handoff notes that tell future `/10x-plan` runs exactly which sections to reuse.

**Contract**: The handoff section must map contract sections to downstream slices: S-04 generated draft, S-05 section editing, S-07 PDF export, and S-08 full saved PDF flow.

#### 2. Change identity status

**File**: `context/changes/generation-export-decision-contract/change.md`

**Intent**: Keep the change identity current as planning and implementation progress.

**Contract**: Planning sets `status: planned` and `updated: 2026-06-02`. Implementation status changes remain governed by `/10x-implement` and must not write to `context/archive/`.

#### 3. Plan progress tracking

**File**: `context/changes/generation-export-decision-contract/plan.md`

**Intent**: Keep execution state in the canonical `## Progress` section only.

**Contract**: `/10x-implement` updates only the checkboxes in `## Progress`, appending commit SHAs when phase work lands. Do not create a sidecar status file.

### Success Criteria:

#### Automated Verification:

- `npx astro sync` completes.
- `npm run lint` completes.
- `npm run build` completes.
- `npx prettier --check context/changes/generation-export-decision-contract` completes.

#### Manual Verification:

- Future S-04 planning can identify the generation input/output contract without asking the same F-01 questions again.
- Future S-07 planning can identify the PDF export recommendation, validation evidence, and fallback trigger.
- The contract reads as a decision artifact, not as premature implementation code.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that F-01 is ready to unblock generated draft and PDF export planning.

---

## Testing Strategy

### Unit Tests:

- No test runner is configured, so do not invent unit tests in this change.
- Validate the JSON fixture with a Node JSON parse command.
- Use Prettier checks for markdown and JSON artifact formatting.

### Integration Tests:

- No product integration exists yet because generation and export routes are out of scope.
- Use `npx astro sync`, `npm run lint`, and `npm run build` as the current repo gates.

### Manual Testing Steps:

1. Read `decision-contract.md` and confirm it answers the F-01 roadmap unknowns.
2. Read `cv-contract.fixture.json` and confirm it exercises all editable sections.
3. Read `pdf-runtime-spike.md` and confirm the recommendation is explicit enough for S-07.
4. Confirm the artifacts do not add production code, database schema, background jobs, or PDF UI ahead of later slices.

## Performance Considerations

The contract keeps the PRD boundary that typical generation should complete under 30 seconds. It should also state that the MVP does not add queues or background jobs for F-01; if generation or export cannot fit the synchronous path later, that is a separate architecture decision.

## Migration Notes

No database migration is part of this change. If future slices persist generated CV drafts, they must coordinate with `cv-persistence-privacy-contract` instead of adding persistence assumptions here.

## References

- Roadmap F-01: `context/foundation/roadmap.md:67`
- PRD generation/export requirements: `context/foundation/prd.md:66`
- Workers runtime risk register: `context/foundation/infrastructure.md:62`
- Deployment runtime validation note: `context/changes/deployment-plan.md:103`
- API route convention: `src/pages/api/auth/signin.ts:1`
- Auth middleware convention: `src/middleware.ts:6`
- Supabase/env convention: `src/lib/supabase.ts:5`
- Worker config: `wrangler.jsonc:1`
- Current package baseline: `package.json:14`
- Current Astro Cloudflare docs checked through Context7: `https://docs.astro.build/en/guides/integrations-guide/cloudflare/`
- Current Cloudflare Workers docs checked through Context7: `https://developers.cloudflare.com/workers/`
- Current React PDF docs checked through Context7: `https://react-pdf.org/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contract Artifact

#### Automated

- [x] 1.1 Contract artifact exists
- [x] 1.2 Contract artifact passes Prettier check
- [x] 1.3 Contract artifact contains required decision headings

#### Manual

- [x] 1.4 Contract answers both F-01 roadmap unknowns
- [x] 1.5 Contract stays inside PRD scope

### Phase 2: Fixture And Runtime Spike

#### Automated

- [ ] 2.1 Fixture file exists
- [ ] 2.2 Fixture parses as JSON
- [ ] 2.3 Spike record exists
- [ ] 2.4 Changed artifacts pass Prettier check

#### Manual

- [ ] 2.5 Fixture is realistic and exercises every editable section
- [ ] 2.6 Spike record makes a clear PDF recommendation and fallback trigger
- [ ] 2.7 Spike avoids premature S-07 implementation

### Phase 3: Verification And Handoff

#### Automated

- [ ] 3.1 Astro sync completes
- [ ] 3.2 Lint completes
- [ ] 3.3 Build completes
- [ ] 3.4 Change-folder Prettier check completes

#### Manual

- [ ] 3.5 S-04 planning can reuse the generation contract
- [ ] 3.6 S-07 planning can reuse the PDF recommendation
- [ ] 3.7 Contract remains a decision artifact
