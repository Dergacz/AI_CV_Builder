---
date: 2026-06-05T17:33:35+0200
researcher: dergacz
git_commit: 8ba3b3d22833d5656159c791bc3ea196f15a18e4
branch: saved-cv-library
repository: Dergacz/AI_CV_Builder
topic: "Saved CV library (S-06): save CV changes and reopen previous CVs from the account"
tags: [research, codebase, saved-cv-library, persistence, supabase, rls, cv-draft, dashboard, api-routes]
status: complete
last_updated: 2026-06-05
last_updated_by: dergacz
---

# Research: Saved CV Library (S-06)

**Date**: 2026-06-05T17:33:35+0200
**Researcher**: dergacz
**Git Commit**: 8ba3b3d22833d5656159c791bc3ea196f15a18e4
**Branch**: saved-cv-library
**Repository**: Dergacz/AI_CV_Builder

## Research Question

For roadmap slice **S-06 `saved-cv-library`** ("user can save CV changes and reopen previously created CVs from their account", FR-009 + FR-011), what does the codebase already provide, and what are the exact integration points, conventions, and gaps for implementing: the `public.cvs` table + RLS, the save/list/reopen/delete API routes, and the saved-CV library UI on the dashboard? The slice is governed by the **F-02 persistence/privacy contract** (done) and depends on **S-02 account access** (done).

## Summary

The slice is functionally unblocked and the contract is precise. The persisted shape, RLS policy, save/delete semantics, and API handoff rules are already decided in `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md`. Everything S-06 persists already exists in code as a validated type (`GeneratedCvDraft`, the single source of truth in `src/lib/cv-draft.ts`). What is **missing** is purely the persistence layer and its UI wiring — none of it exists yet:

- **No database / data layer exists at all.** There is no `supabase/migrations/` directory (it does not exist), no `cvs` table, and **no generated DB types file**. The Supabase server client (`src/lib/supabase.ts`) is created **untyped** (no `Database` generic). S-06 will author the **first migration in the repo**.
- **API conventions are well-established** by `src/pages/api/cv/generate.ts` and the auth routes: `prerender = false`, per-request `createClient(headers, cookies)`, `context.locals.user` auth gate, a discriminated-union JSON envelope (`{ ok: true, ... } | { ok: false, error, message }`), and a local `json(status, body)` helper. S-06 routes should mirror this exactly.
- **The draft is held only in client React state** (`QuestionnaireFlow` `useState`) and is **lost on reload** — there is no existing save call anywhere. The save integration point is the post-generation / edit surface (`CvEditor` rendered inside `QuestionnaireFlow`).
- **A gap to resolve in planning:** the contract's `source_snapshot` requires `{ questionnaireVersion, answers, capturedAt }`, but the draft's own `source` field (`src/lib/cv-draft.ts:77-82`) contains only `questionnaireVersion` + provenance — **not the answers**. The questionnaire `answers` live separately in client state (`CvQuestionnaireAnswers`) and must be threaded into the save payload (and restored on reopen).
- **The dashboard is a placeholder shell** (`src/pages/dashboard.astro`) that literally says "Saved CVs: Planned for the saved-library slice" — this is the home for the library list.
- **i18n is not yet in place** (S-09 not done). Convention: register S-06's user-facing strings into a centralized English copy module (mirroring `src/lib/cv-editor-copy.ts`) so S-09 can wrap it per-locale later — do not scatter inline strings in JSX.

## Detailed Findings

### Area 1 — The persisted shape (`GeneratedCvDraft`) already exists and is validated

`src/lib/cv-draft.ts` is the **single source of truth** for the draft contract; `src/types.ts` re-exports the inferred types (`src/types.ts:8-21`) so the service, API route, and UI all agree on one definition.

The zod schema `generatedCvDraftSchema` (`src/lib/cv-draft.ts:74-92`):

```ts
export const generatedCvDraftSchema = z.object({
  schemaVersion: z.literal(1),
  language: z.enum(["en", "pl", "ru"]),
  source: z.object({
    questionnaireVersion: z.string(),
    generatedAt: z.string(),
    modelProvider: z.string().optional(),
    modelName: z.string().optional(),
  }),
  sections: z.object({
    summary: summarySectionSchema, // { headline?: string; body: <non-empty> }
    experience: z.array(experienceItemSchema),
    education: z.array(educationItemSchema),
    skills: z.array(skillGroupSchema), // { label; items: min(1) }
    languages: z.array(languageItemSchema),
  }),
  assumptions: z.array(draftAssumptionSchema),
  warnings: z.array(draftWarningSchema), // code ∈ minimal_input|missing_*|low_confidence
});
export type GeneratedCvDraft = z.infer<typeof generatedCvDraftSchema>;
```

The discriminated response type S-06 can reuse / mirror (`src/lib/cv-draft.ts:104-107`):

```ts
export type GenerateDraftResponse =
  | { ok: true; draft: GeneratedCvDraft }
  | { ok: false; error: GenerationErrorBucket; message: string };
```

**Implication for S-06**: the `draft` JSONB column stores exactly a `generatedCvDraftSchema`-valid object. The save route should re-validate the incoming draft with `generatedCvDraftSchema` (defense-in-depth, mirroring the generation service's own re-validation at `src/lib/services/cv-generation.ts:296-302`). The contract's requirement that the row's `language` column equal `draft.language` is satisfied by reading `draft.language` (`src/lib/cv-draft.ts:76`) — no separate client-supplied language is needed.

### Area 2 — Source snapshot gap: answers are NOT inside the draft

The contract requires `source_snapshot = { questionnaireVersion, answers, capturedAt }` (`persistence-privacy-contract.md:62-73`). But the draft's `source` (`src/lib/cv-draft.ts:77-82`) only carries `questionnaireVersion`, `generatedAt`, `modelProvider`, `modelName` — **the raw answers are not in the draft**.

The questionnaire answers are a separate type (`src/lib/cv-questionnaire.ts:7-16`):

```ts
export const QUESTIONNAIRE_VERSION = "mvp-v1";
export const cvOutputLanguages = ["en", "pl", "ru"] as const;
export type CvOutputLanguage = (typeof cvOutputLanguages)[number];
export interface CvQuestionnaireAnswers {
  fullName;
  targetRoleOrGoal;
  outputLanguage: CvOutputLanguage;
  experience;
  education;
  skillsAndTools;
  spokenLanguages;
  additionalContext; // all string
}
```

These answers are held in `QuestionnaireFlow` client state and submitted to `/api/cv/generate` (validated by `answersSchema` at `src/pages/api/cv/generate.ts:16-25`), but they are **not currently retained alongside the draft for saving**. Planning must decide how `answers` reach the save route (e.g. include them in the save request body, validated server-side with the same answer schema) and how they are restored when a saved CV is reopened.

### Area 3 — Generation service & API route conventions

`src/lib/services/cv-generation.ts` calls OpenAI via `fetch` (Workers-compatible), stamps `schemaVersion`/`language`/`source` server-side (`:284-294`), and re-validates with zod before returning (`:296-302`). It documents the F-02 privacy rule: never log raw answers, prompt, model response, or draft content (`:13-14`).

`src/pages/api/cv/generate.ts` is the **template S-06 routes should follow**:

- `export const prerender = false;` (`:8`)
- Auth gate: `if (!context.locals.user) return json(401, ...)` (`:35-41`)
- Body-size guard via `content-length` → 413 (`:43-46`)
- `safeParse` body with a server-only zod schema (`:55-58`)
- JSON envelope helper `json(status, body)` returning `Content-Type: application/json` (`:27-32`)
- Status mapping: 200 ok / 503 service_unavailable / 422 other (`:65`)

Note the route uses `context.locals.user` (set by middleware) for the gate; the contract additionally requires calling `supabase.auth.getUser()` in authorization-sensitive routes (`persistence-privacy-contract.md:223-227`). RLS is the load-bearing guard regardless (`:130-136`).

Auth routes (`src/pages/api/auth/signin.ts`) use **form + redirect** rather than JSON — S-06's data routes should use the **JSON envelope** style (like `generate.ts`), not redirects.

### Area 4 — Supabase client, middleware, and the missing data layer

`src/lib/supabase.ts:5-24` — the only client factory:

```ts
export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null; // null when unconfigured
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: { getAll, setAll } });
}
```

- It is **untyped** — `createServerClient(...)` with no `Database` generic. There is **no generated types file** anywhere under `src/`.
- Returns `null` when env is missing → routes must treat that as `service_unavailable` (contract `:222-224`).
- Env declared as optional server secrets in `astro.config.mjs:18-22` (`SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY` secret; `OPENAI_MODEL` public), read via `astro:env/server`.

`src/middleware.ts:4-22` — sets `context.locals.user` via `supabase.auth.getUser()` and gate-protects `PROTECTED_ROUTES = ["/dashboard", "/cv"]` (`:4`), redirecting to `/auth/signin`. `App.Locals` declares only `user` (`src/env.d.ts:1-5`).

**No migrations exist**: `supabase/migrations/` **does not exist** (only `supabase/config.toml` and an empty `supabase/snippets/`). Per CLAUDE.md the naming format is `YYYYMMDDHHmmss_short_description.sql`, and new tables must enable RLS with granular per-operation, per-role policies. S-06 authors the first migration.

### Area 5 — Where the draft lives in the UI and where "save" hooks in

- `src/pages/cv/new.astro` renders `<QuestionnaireFlow client:load />` (the only generation entry point).
- `QuestionnaireFlow.tsx` holds `const [draft, setDraft] = useState<GeneratedCvDraft | null>(null)` (~`:73`) and `const editor = useCvDraftEditor(setDraft)` (~`:75`); when a draft exists it renders `<CvEditor draft={draft} editor={editor} />` (~`:150-151`).
- `src/components/hooks/useCvDraftEditor.ts` owns per-section edit state; `commitSection` (`:47-61`) applies edits **immutably**, preserving the `GeneratedCvDraft` shape. The draft stays in the island's state; edits never leave the client.
- **No persistence exists** — the edited draft is **lost on reload**. There is no save affordance, no save hook, no save route.

**Save integration point**: a "Save" action on the `CvEditor` surface (post-generation / after edits) that POSTs `{ draft, answers, title? }` to a new `/api/cv` route. **Reopen** loads a saved row's `draft` back into the same `CvEditor` (the read/edit template is reusable), and restores `answers` from `source_snapshot`.

### Area 6 — Dashboard / workspace UI (home for the library)

- `src/pages/dashboard.astro` is the post-login landing and S-02 "workspace shell." It currently shows a hero + a status card whose line reads **"Saved CVs: Planned for the saved-library slice"** (~`:66`) — the explicit placeholder S-06 replaces with the saved-CV list. Header has the user email + sign-out (`:10-25`); hero "Start CV" links to `/cv/new` (`:27-51`).
- Reusable building blocks: shadcn `Button` (`src/components/ui/button.tsx`, CVA variants incl. `destructive` for delete), `ItemCard` pattern (`src/components/cv/CvSectionEditors.tsx:72-91`), `DraftSection` (`src/components/cv/CvTemplate.tsx`), card grids in `ProductLanding.astro:141-166`.
- **Confirmation dialog already exists** to reuse for delete: `ConfirmDiscardDialog` in `src/components/cv/CvEditor.tsx:222-304` (custom modal, focus trap, Escape handling).
- **Feedback patterns** (no toast lib): `role="alert"` error box (`QuestionnaireFlow.tsx:324-330`), `role="status"` + `aria-live="polite"` status (`:313-321`), top-of-page `Banner.astro`. Save-success feedback does not exist yet — follow the `role="status"` pattern.
- Layout `src/layouts/Layout.astro` provides no global nav; each page brings its own header. `Topbar.astro` / `ProductLanding.astro` link "Workspace" → `/dashboard`.

### Area 7 — i18n state

- No active en/pl/ru UI catalog yet; **S-09 interface-localization is not implemented** (roadmap status `ready`).
- The established pattern is centralized copy modules: `src/lib/landing-content.ts` (`landingContentByLocale`, currently en-only), `src/lib/cv-editor-copy.ts` (S-05's centralized strings, explicitly structured "so S-09 can wrap one module per locale instead of combing JSX"), and `src/lib/cv-draft-messages.ts` (error-bucket messages).
- **For S-06**: add user-facing strings to a centralized English copy module (e.g. a new `cv-library-copy.ts` mirroring `cv-editor-copy.ts`), not inline in JSX, so S-09 can localize later without rewriting components.

## Code References

- `src/lib/cv-draft.ts:74-107` — `generatedCvDraftSchema` and `GenerateDraftResponse` (the shape S-06 persists/returns)
- `src/types.ts:8-21` — re-export surface for draft types
- `src/lib/cv-questionnaire.ts:1-16` — `QUESTIONNAIRE_VERSION`, `CvOutputLanguage`, `CvQuestionnaireAnswers` (source_snapshot.answers)
- `src/lib/services/cv-generation.ts:284-302` — server-side stamping of `source` + zod re-validation; privacy note `:13-14`
- `src/pages/api/cv/generate.ts:8,16-25,27-66` — the API-route template (prerender, schema, json helper, auth gate, status mapping)
- `src/pages/api/auth/signin.ts:16-32` — form+redirect auth route (contrast with JSON envelope)
- `src/lib/supabase.ts:5-24` — untyped per-request Supabase client; null when unconfigured
- `src/middleware.ts:4-22` — `context.locals.user`, `PROTECTED_ROUTES = ["/dashboard","/cv"]`
- `src/env.d.ts:1-5` — `App.Locals` declares only `user`
- `astro.config.mjs:18-22` — env schema (`SUPABASE_URL/KEY`, `OPENAI_*`)
- `src/components/hooks/useCvDraftEditor.ts:47-61` — immutable `commitSection`; draft stays client-side
- `src/pages/dashboard.astro` (~`:66`) — "Saved CVs: Planned for the saved-library slice" placeholder
- `src/components/cv/CvEditor.tsx:222-304` — reusable `ConfirmDiscardDialog` for delete confirmation
- `supabase/config.toml` (+ no `supabase/migrations/`) — no data layer / migration exists yet

## Architecture Insights

- **Single-source-of-truth draft contract**: one zod schema (`cv-draft.ts`) drives types via `z.infer`, re-exported through `@/types`. New persistence code should import from `@/lib/cv-draft` / `@/types`, never redefine the shape.
- **Server-only zod, client-light islands**: validation schemas live in API routes / services (e.g. `answersSchema` deliberately kept out of `cv-questionnaire.ts` so zod isn't bundled into the client island, `api/cv/generate.ts:14-15`). S-06 save validation should follow this split.
- **Defense-in-depth auth**: middleware sets `locals.user`; routes re-check; RLS is the real boundary. S-06 must implement all three (the table doesn't exist yet, so RLS is net-new).
- **JSON envelope for data routes, redirects for auth form posts** — two distinct conventions; S-06 data routes use the JSON envelope.
- **Untyped Supabase + no generated types** is the current reality. Planning decision: run untyped for the MVP table, or introduce `supabase gen types` + a `Database` generic. The contract keeps `draft`/`source_snapshot` as `jsonb` with app-layer runtime validation regardless (`persistence-privacy-contract.md:183-184`).

## Historical Context (from prior changes)

- `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md` (F-02, done) — **the governing contract**: row shape (`:25-60`), `GeneratedCvDraft` preservation (`:42-59`), source snapshot (`:62-73`), listing metadata `title/language/created_at/updated_at` (`:76-86`), explicit-save-overwrite semantics (`:88-106`), hard delete (`:108-123`), RLS + representative SQL sketch (`:126-186`), logging rules (`:188-215`), S-06 API handoff rules (`:217-232`), and non-decisions left to S-06 (`:267-273`: migration filename, type-gen command, route paths, save-button copy, whether first UI exposes delete).
- `context/changes/generation-export-decision-contract/cv-contract.fixture.json` — the F-01 fixture instance of the draft (matches `generatedCvDraftSchema`); useful as a test fixture for save/reopen round-trips.
- `context/changes/cv-template-section-editing/plan.md` (S-05, done) — explicitly states the `GeneratedCvDraft` shape is preserved byte-for-byte "so S-06 (save) and S-07 (PDF export) consume the edited draft unchanged"; editing is in-memory only, draft always stays schema-valid.
- `context/changes/generated-cv-draft/plan.md` (S-04, done) — `source` provenance stamping; `schemaVersion: 1`; privacy constraints.
- `context/changes/account-access-for-cv-work/plan.md` (S-02, done) — `/dashboard` as protected workspace shell, `Astro.locals.user` available.
- `context/archive/` is empty (no prior saved-CV or i18n work archived).

## Related Research

- No prior `research.md` exists for sibling slices; the F-02 contract is the canonical upstream artifact. Files to load first when planning (per `persistence-privacy-contract.md:258-265`): the F-02 contract, the F-01 `decision-contract.md`, `cv-contract.fixture.json`, and `pdf-runtime-spike.md`.

## Open Questions

1. **Answers → save payload**: how do `CvQuestionnaireAnswers` reach the save route for `source_snapshot.answers`, given they are not part of the draft? (Include in save body + server-validate, or stash server-side at generation time?) Owner: planning.
2. **Typed vs untyped Supabase**: introduce generated `Database` types (+ `gen types` command) for the new `cvs` table, or keep the existing untyped client with app-layer zod validation? Owner: planning.
3. **Reopen target route**: does reopen load into the existing `/cv/new` `QuestionnaireFlow`/`CvEditor` island (with a `cvId`), or a new `/cv/[id]` route? The current editor lives only inside the questionnaire flow. Owner: planning.
4. **Save-vs-update identity**: how the client knows whether it's creating a new row or updating an existing saved CV (carry a `cvId` through edit state after first save). Owner: planning.
5. **Delete in first UI?** F-02 leaves open whether the first library UI exposes delete or only prepares the route (`persistence-privacy-contract.md:273`). Owner: planning.
6. **Default title**: the contract requires a default title when unnamed (`:84-86`) but doesn't fix the rule (e.g. `targetRoleOrGoal` + date?). Owner: planning.
