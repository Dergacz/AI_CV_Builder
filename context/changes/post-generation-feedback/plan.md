# Post-Generation Feedback (S-05 / FR-010) Implementation Plan

## Overview

After a CV is generated, let the user mark the result **Helpful** or **Not Helpful** and add an **optional text comment**, captured inline in the generated-draft editor. Feedback is persisted in a new `public.feedback` table keyed by a freshly-minted, content-free **generation event identifier** — never by the CV/draft — and an aggregate, content-free `feedback_submitted` analytics event is emitted to the existing PostHog sink. This reuses F-01's no-raw-content recording contract and closes roadmap slice **S-05** / **FR-010**.

## Current State Analysis

- **Generation endpoint** `src/pages/api/cv/generate.ts:21` returns `GenerateDraftResponse = { ok: true; draft }` — **no identifier of any kind**. A CV UUID exists only after a separate save (`POST /api/cv` → `cv.id`). So there is **no "generation event identifier" today**; one must be introduced.
- **Generation UI flow**: `QuestionnaireFlow.tsx:138` holds the draft in React state and renders `CvEditor.tsx` on `status === "success"`. This is pre-save and is the natural mount point for the feedback widget. The same `CvEditor` is reused on the saved-CV reopen flow, distinguished by the **absence of the `onEditAnswers` prop** (`CvEditor.tsx:54`) — we use that same signal to scope feedback to the just-generated draft only.
- **Observability contract (F-01)** `src/lib/observability/`:
  - `track(event, props, identity)` (`index.ts:61`) sends to PostHog EU directly; **no DB events table exists**.
  - `scrub.ts:3` enforces a strict **10-key allowlist** (`surface, route, status, error_type, error_location, duration_ms, model_provider, locale, success, method`); every other key (and any string > 120 chars) is silently dropped. This is the privacy boundary.
  - `funnel_cv_generated` is emitted server-side in `generate.ts:57` with `{ locale, model_provider, duration_ms, success }` — no unique id.
  - Event-name union is `ObservabilityEvent` (`index.ts:11`); funnel names live in `events.ts`.
- **Persistence conventions** `supabase/migrations/20260606103740_create_cvs.sql`: `user_id uuid not null references auth.users(id) on delete cascade`, RLS enabled, owner-only per-operation policies using `auth.uid() = user_id`, a reusable `public.set_updated_at()` trigger, and a `user_id`-scoped index.
- **API route conventions** `src/pages/api/cv/index.ts:48`: `prerender = false`, `context.locals.user` guard, bounded JSON read, zod `safeParse`, `createClient` + `safeGetUser`, repository call under RLS, `track(...)` on success, discriminated `{ ok }` JSON responses.
- **i18n convention**: per-feature zod-free copy module indexed by locale, e.g. `cv-editor-copy.ts` exposes `getCvEditorCopy(locale)` over `Record<UiLocale, ...>` (en/pl/ru). Client tracking via `trackClient` (`client.browser.ts:98`).

## Desired End State

A signed-in user generating a CV sees, alongside the generated draft, a compact "Was this helpful?" prompt with **Helpful** / **Not Helpful** buttons and an optional comment box. Submitting stores one row in `public.feedback` (rating + optional comment + `generation_event_id` + `user_id`), upserting on re-submission so the user can correct or amend. A content-free `feedback_submitted` event (`helpful`, `locale`, `generation_event_id`) reaches PostHog so the helpful-rate can be joined to `funnel_cv_generated`. No CV/answer/draft content is ever stored alongside feedback or sent to PostHog. The core generate → edit → save → export flow is unchanged.

Verify by: generating a CV, submitting Helpful with a comment, confirming a `public.feedback` row exists with the right `generation_event_id` and **no** draft/answer content; re-submitting as Not Helpful and confirming the same row updated (no duplicate); confirming the PostHog `feedback_submitted` payload contains only allowlisted keys.

### Key Discoveries:

- No generation identifier exists — `generate.ts:21` response carries only `draft` (`cv-draft.ts:105`). **Mint it in the route** with `crypto.randomUUID()` (Workers runtime supports it).
- The scrub allowlist (`scrub.ts:3`) will **silently drop** `generation_event_id` and any verdict key unless explicitly added — this is the one contract change that must be deliberate.
- Roadmap warning (S-05): *"the only trap is re-exposing CV content by linking feedback to the draft — store against the generation event id only."* → `public.feedback` must **not** FK to `public.cvs`; `generation_event_id` is a free-standing correlation UUID (there is no generations table).
- The free-text comment is raw user content → it **must not** go to PostHog (allowlist drops it anyway); it lives only in `public.feedback`.
- `CvEditor` is reused for saved-CV reopen; gating the widget on `onEditAnswers` presence keeps feedback scoped to fresh generations (out-of-scope item: no feedback on library CVs).

## What We're NOT Doing

- No admin/in-app screen to browse feedback (read via DB / PostHog only).
- No feedback entry point from the saved-CV library or reopen flow.
- No rate-limiting/anti-spam beyond auth + the one-row-per-generation upsert.
- No special re-prompt/reset logic on regeneration beyond the new generation having its own id and a fresh widget.
- No persisting `generation_event_id` onto `public.cvs` (deliberate, to avoid CV↔feedback coupling).
- No anonymous feedback — generation already requires auth, so feedback is always authenticated.

## Implementation Approach

Build back-to-front: (1) establish the identifier and extend the observability contract; (2) stand up the store + API; (3) wire the UI; (4) cover with E2E + regression. The identifier minted in Phase 1 is the seam everything else hangs off: returned to the client for the widget, attached to the analytics event for correlation, and used as the feedback row key.

## Critical Implementation Details

- **State sequencing (id provenance):** the `generation_event_id` is minted **in the API route**, not the generation service, so the same value is used for both the `funnel_cv_generated` prop and the response body. The service keeps returning its narrow `{ ok, draft }` result; the route augments the success response with the id.
- **User experience spec:** when `generationEventId` changes (regeneration), the widget must reset to its unsubmitted state — key the widget on `generationEventId` so React remounts it. The widget is fail-soft: a submit failure shows an inline retry and never blocks edit/save/export; if `generationEventId` is absent the widget renders nothing.
- **Privacy invariant:** the comment field is persisted only to `public.feedback`. The `feedback_submitted` event payload must contain solely allowlisted, content-free keys. Adding `generation_event_id`/`helpful` to the allowlist is the only sanctioned widening of the F-01 boundary in this change.

---

## Phase 1: Generation event identifier + observability contract

### Overview

Introduce the content-free generation event identifier, return it to the client, attach it to the existing generation funnel event, and widen the observability contract just enough to carry feedback signals.

### Changes Required:

#### 1. Mint + return the generation event id

**File**: `src/pages/api/cv/generate.ts`

**Intent**: On a successful generation, mint a `generation_event_id` via `crypto.randomUUID()`, attach it to the `funnel_cv_generated` event props, and include it in the 200 response body.

**Contract**: Success response becomes `{ ok: true; draft; generationEventId: string }`. The `funnel_cv_generated` `track(...)` call gains `generation_event_id: <uuid>`. Failure responses are unchanged.

#### 2. Generate response type split

**File**: `src/lib/cv-draft.ts`

**Intent**: Separate the generation service's internal result from the API wire response so the success wire shape carries `generationEventId` without forcing the service to produce it.

**Contract**: Keep the service result type (`{ ok: true; draft } | { ok: false; error; message }`). Add/adjust `GenerateDraftResponse` so its success variant is `{ ok: true; draft: GeneratedCvDraft; generationEventId: string }`. The client (`QuestionnaireFlow`) consumes `GenerateDraftResponse`.

#### 3. Extend the scrub allowlist

**File**: `src/lib/observability/scrub.ts`

**Intent**: Allow the two new content-free signal keys through the allowlist so they reach PostHog; everything else still drops.

**Contract**: Add `"generation_event_id"` and `"helpful"` to `allowedPropertyKeys`. (UUID is < 120 chars and `helpful` is boolean, so existing `isSafeValue` covers them.)

#### 4. Register the feedback event name

**File**: `src/lib/observability/index.ts`

**Intent**: Add `feedback_submitted` to the recognized server event union so the Phase 2 API can emit it through `track`.

**Contract**: `ObservabilityEvent` union gains `"feedback_submitted"`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build` (or `astro check`)
- Linting passes: `npm run lint`
- Unit tests pass: `npm test` — new tests assert (a) `generate.ts` 200 body includes a UUID `generationEventId`, (b) the `funnel_cv_generated` payload carries `generation_event_id`, (c) `scrub()` now passes `generation_event_id` + `helpful` and still drops a disallowed key.

#### Manual Verification:

- Generating a CV in the running app returns a `generationEventId` in the network response.
- The `funnel_cv_generated` event in PostHog shows a `generation_event_id` property.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Feedback store + API

### Overview

Create the owner-scoped feedback table and a fail-soft endpoint that upserts a rating + optional comment against the generation event id and emits a content-free analytics event.

### Changes Required:

#### 1. Feedback table migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_feedback.sql`

**Intent**: Persist one feedback row per (user, generation) with rating, optional comment, owner FK, and timestamps; enforce RLS owner-only and an upsert key.

**Contract**: `public.feedback` columns: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `generation_event_id uuid not null`, `helpful boolean not null`, `comment text` (nullable; `check (comment is null or char_length(comment) <= 1000)`), `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. Add `unique (user_id, generation_event_id)`. Reuse `public.set_updated_at()` via a `before update` trigger. Enable RLS; add owner-only `select` / `insert (with check user_id = auth.uid())` / `update (using + with check)` policies mirroring the `cvs` table. **No FK to `public.cvs`.**

#### 2. Feedback request schema + types

**Files**: `src/lib/cv-answers.schema.ts` (or a new `src/lib/feedback.schema.ts`), `src/types.ts`

**Intent**: Validate the submission and define wire types.

**Contract**: zod schema `{ generationEventId: string().uuid(), helpful: boolean(), comment: string().max(1000).optional() }` (empty/whitespace-only comment normalized to undefined). Types: `SubmitFeedbackResponse = { ok: true } | { ok: false; error: "feedback_failed" | "service_unavailable"; message: string }`.

#### 3. Feedback repository

**File**: `src/lib/services/feedback-repository.ts`

**Intent**: Encapsulate the upsert under the user's RLS-scoped client.

**Contract**: `upsertFeedback(supabase, userId, { generationEventId, helpful, comment }): Promise<void>` — upsert on conflict `(user_id, generation_event_id)`, updating `helpful` + `comment`. Never writes draft/answer content.

#### 4. Feedback API route

**File**: `src/pages/api/cv/feedback.ts`

**Intent**: Authenticated, validated, fail-soft endpoint that upserts feedback and emits a content-free analytics event.

**Contract**: `export const prerender = false; POST`. Mirrors `api/cv/index.ts` structure: `locals.user` guard → bounded JSON read → `safeParse` → `createClient` + `safeGetUser` → `upsertFeedback` → `track("feedback_submitted", { helpful, locale, generation_event_id }, locals.observability)` → `{ ok: true }`. The comment is **never** passed to `track`. Errors map to `{ ok: false, error, message }`.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npm run db:start` / local supabase migration apply
- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit/contract tests pass: `npm test` — assert (a) unauthenticated → 401, (b) invalid body → 400, (c) valid submit upserts and returns `{ ok: true }`, (d) the emitted `feedback_submitted` payload contains only `helpful`/`locale`/`generation_event_id` and **never** the comment text, (e) re-submitting the same `generationEventId` updates rather than duplicates.

#### Manual Verification:

- `POST /api/cv/feedback` with a valid body inserts a `public.feedback` row; re-posting updates it (no duplicate).
- RLS: a second user cannot read/update the first user's feedback row.
- The stored row contains no draft/answer content.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 3.

---

## Phase 3: Feedback widget UI + i18n

### Overview

Render the Helpful/Not-Helpful + optional comment widget inline in the generated-draft editor, wired to the Phase 2 endpoint, localized across en/pl/ru, fail-soft and editable.

### Changes Required:

#### 1. Feedback copy module

**File**: `src/lib/cv-feedback-copy.ts`

**Intent**: Zod-free, locale-indexed copy for the widget, following the `cv-editor-copy.ts` pattern.

**Contract**: `getCvFeedbackCopy(locale): CvFeedbackCopy` over `Record<UiLocale, ...>`. Keys: prompt/question, helpful, notHelpful, commentLabel (optional), commentPlaceholder, submit, submitting, thanks, errorRetry, plus aria labels. en/pl/ru.

#### 2. Feedback submit hook

**File**: `src/components/hooks/useCvFeedback.ts`

**Intent**: Manage submit state (idle/submitting/submitted/error), POST to `/api/cv/feedback`, and expose a fail-soft submit.

**Contract**: `useCvFeedback({ locale })` → `{ status, error, submit(generationEventId, helpful, comment?) }`. Network/validation failure sets `status: "error"` with a localized retry message; never throws into render.

#### 3. Feedback widget component

**File**: `src/components/cv/CvFeedback.tsx`

**Intent**: Compact accessible widget: two verdict buttons, optional comment textarea (shown for both verdicts), submit, thank-you state; editable after submit.

**Contract**: Props `{ generationEventId: string; locale: UiLocale }`. Uses `getByRole`-friendly markup (buttons, labeled textarea, `role="alert"` on error, `role="status"` on thanks). Comment capped at 1000 chars (`maxLength`). After submit, shows thank-you but allows changing the verdict/comment and re-submitting (upsert). Resets when `generationEventId` changes.

#### 4. Thread the id and mount the widget

**Files**: `src/components/cv/QuestionnaireFlow.tsx`, `src/components/cv/CvEditor.tsx`

**Intent**: Carry `generationEventId` from the generate response into `CvEditor`, and render `CvFeedback` only for fresh generations.

**Contract**: `QuestionnaireFlow` stores `generationEventId` from `data.generationEventId` (state, reset on regenerate/edit-answers) and passes it to `CvEditor`. `CvEditor` accepts an optional `generationEventId` prop and renders `<CvFeedback generationEventId=… locale=… key={generationEventId} />` only when both `generationEventId` and `onEditAnswers` are present (scopes to fresh-generation, not reopen). Placed near the bottom of the editor surface.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run build`
- Linting passes: `npm run lint`
- Unit/component tests pass: `npm test` — assert (a) widget submits `{ generationEventId, helpful, comment }` to the endpoint, (b) comment is optional, (c) submit failure surfaces an inline retry and does not crash, (d) all three locales resolve copy.

#### Manual Verification:

- After generation, the widget appears below the draft; Helpful/Not-Helpful + comment submits and shows a thank-you.
- Changing the verdict after submit re-submits and updates the same row.
- Re-generating resets the widget; the reopen-saved-CV flow shows no widget.
- Widget renders correctly in en/pl/ru; keyboard/screen-reader accessible.

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 4.

---

## Phase 4: E2E + regression

### Overview

Cover the browser-level feedback flow with Playwright and confirm the core funnel is unaffected.

### Changes Required:

#### 1. Feedback E2E spec

**File**: `e2e/post-generation-feedback.spec.ts`

**Intent**: Drive the real UI with generation + feedback mocked at the network seam (per `e2e/README.md`).

**Contract**: `page.route('**/api/cv/generate', …)` returns a fixture draft **including `generationEventId`**; `page.route('**/api/cv/feedback', …)` returns `{ ok: true }`. Assertions via `getByRole`: widget visible after generation, submit Helpful → thank-you state, comment field accepts text, an error mock surfaces the inline retry. Unique-id discipline + standalone setup per `e2e/README.md`.

#### 2. Regression confirmation

**File**: existing core-flow E2E (`core-flow-regression-net`) — run, adjust generate mock if it now must include `generationEventId`.

**Intent**: Ensure generate → edit → save → export still passes with the response-shape change.

**Contract**: Update any shared generate mock/fixture to include `generationEventId`; no behavioral change to the core flow.

### Success Criteria:

#### Automated Verification:

- E2E passes: `npm run test:e2e` (with local Supabase up per `e2e/README.md`)
- Full unit suite passes: `npm test`
- Build + lint pass: `npm run build` && `npm run lint`

#### Manual Verification:

- End-to-end in a browser: generate → submit feedback → see thank-you, with no regression to save/export.

**Implementation Note**: Final phase — confirm the full suite green before marking the change done.

---

## Testing Strategy

### Unit Tests:

- `generate.ts`: response includes `generationEventId`; `funnel_cv_generated` carries `generation_event_id`.
- `scrub.ts`: new keys pass; disallowed keys still drop.
- feedback schema: valid/invalid bodies, comment length cap, whitespace normalization.
- `feedback.ts` route: auth, validation, upsert-vs-duplicate, **comment never emitted to `track`**.
- `useCvFeedback` / `CvFeedback`: submit payload, optional comment, fail-soft error, locale resolution.

### Integration Tests:

- Migration applies; RLS denies cross-user read/update; upsert updates a single row on conflict.

### Manual Testing Steps:

1. Generate a CV; confirm the widget appears and the network response has `generationEventId`.
2. Submit Helpful + comment; verify a single `public.feedback` row with the right id and no CV content.
3. Switch to Not Helpful; verify the same row updated (no duplicate).
4. Inspect the PostHog `feedback_submitted` event — only `helpful`/`locale`/`generation_event_id`, no comment.
5. Regenerate → widget resets; open a saved library CV → no widget.
6. Confirm generate → edit → save → export still works (regression).

## Performance Considerations

Negligible: one indexed upsert per submission and one fire-and-forget analytics call (already timeout-bounded at 1.5 s in `observability/index.ts`). No new hot paths.

## Migration Notes

Single additive migration creating `public.feedback`; no backfill. `on delete cascade` to `auth.users` means S-08 account deletion purges feedback automatically — no extra purge logic needed.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-05)
- PRD requirement: `context/foundation/prd-v3.md` (FR-010, lines 244-251)
- F-01 contract: `src/lib/observability/{index.ts,scrub.ts,events.ts,client.browser.ts}`
- Generation flow: `src/pages/api/cv/generate.ts`, `src/components/cv/{QuestionnaireFlow,CvEditor}.tsx`
- Persistence + RLS pattern: `supabase/migrations/20260606103740_create_cvs.sql`, `src/pages/api/cv/index.ts`
- E2E conventions: `e2e/README.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Generation event identifier + observability contract

#### Automated

- [x] 1.1 Type checking passes (`npm run build` / `astro check`) — 97a056e
- [x] 1.2 Linting passes (`npm run lint`) — 97a056e
- [x] 1.3 Unit tests: generate returns `generationEventId`, event carries `generation_event_id`, scrub passes new keys / drops disallowed — 97a056e

#### Manual

- [x] 1.4 Generating in-app returns `generationEventId` in the response — 97a056e
- [x] 1.5 PostHog `funnel_cv_generated` shows `generation_event_id` — 97a056e

### Phase 2: Feedback store + API

#### Automated

- [x] 2.1 Migration applies cleanly (local supabase) — 4912334
- [x] 2.2 Type checking passes (`npm run build`) — 4912334
- [x] 2.3 Linting passes (`npm run lint`) — 4912334
- [x] 2.4 Contract tests: auth 401, invalid 400, valid upsert ok, event content-free (no comment), re-submit updates not duplicates — 4912334

#### Manual

- [x] 2.5 POST inserts then updates a single `public.feedback` row — 4912334
- [x] 2.6 RLS blocks cross-user access — 4912334
- [x] 2.7 Stored row has no draft/answer content — 4912334

### Phase 3: Feedback widget UI + i18n

#### Automated

- [x] 3.1 Type checking passes (`npm run build`) — 1fbb1d9
- [x] 3.2 Linting passes (`npm run lint`) — 1fbb1d9
- [x] 3.3 Component tests: submit payload, optional comment, fail-soft retry, all locales resolve — 1fbb1d9

#### Manual

- [x] 3.4 Widget appears after generation; submit shows thank-you — 1fbb1d9
- [x] 3.5 Changing verdict re-submits/updates same row — 1fbb1d9
- [x] 3.6 Regenerate resets widget; reopen-saved-CV shows no widget — 1fbb1d9
- [x] 3.7 Renders + accessible in en/pl/ru — 1fbb1d9

### Phase 4: E2E + regression

#### Automated

- [x] 4.1 E2E passes (`npm run test:e2e`) — 185d296
- [x] 4.2 Full unit suite passes (`npm test`) — 185d296
- [x] 4.3 Build + lint pass — 185d296

#### Manual

- [x] 4.4 Browser end-to-end: generate → feedback → thank-you, no save/export regression — 185d296
