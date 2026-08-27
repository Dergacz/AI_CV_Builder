// GENERATED FILE — do not edit by hand.
//
// Source of truth: context/review-criteria.md
// Regenerate:      npm run criteria:build  (in packages/code-reviewer)
// Verify in CI:    npm run criteria:check
//
// The rubric text is copied verbatim from the document because structured
// output rejects `minimum`/`maximum` on an integer: the field description is
// the only lever that tells the model what a 1 and a 10 mean.
import { z } from "zod";

/** The five criteria, in document order. */
export const CRITERIA = [
  {
    number: 1,
    key: "contractSync",
    slug: "contract-sync",
    title: "Contract synchrony",
    name: "Contract synchrony",
    rubric: { one: "A PR changes `generatedCvDraftSchema` by adding a field, changing a type, or removing optionality, but does not update `DRAFT_CONTENT_JSON_SCHEMA`. Strict mode, with its `additionalProperties: false`, keeps returning the old shape; the new field silently does not reach validation, and zod either applies a default or never sees the field. Tests stay green, logs stay quiet, and the defect is noticed in the browser a week later. The same score applies when a migration changes a column or constraint while `database.types.ts` is not regenerated, or when application code still relies on an invariant the database schema no longer enforces.", ten: "Draft shape changes land in one PR across every representation: zod schema, OpenAI JSON Schema, and TypeScript types. The diff shows the related edits next to each other, and a reviewer can verify in about ten seconds that the shapes match. If the PR touches the database, the migration and regenerated `database.types.ts` are in the same PR, and the migration comments state what the constraint, trigger, or policy guarantees so the application does not duplicate that rule and drift from it. Ideally, drift is impossible because one shape is derived from another instead of being rewritten by hand." },
  },
  {
    number: 2,
    key: "honestFailure",
    slug: "honest-failure",
    title: "Honest failure",
    name: "Honest failure",
    rubric: { one: "A PR adds salvage logic around generation: `.partial()` on `generatedCvDraftSchema`, `.catch(() => fallback)`, defaults for sections the model did not return, or partial parsing that keeps whatever happened to parse. The user receives a CV with an empty experience section or an invented placeholder instead of an honest error. The worst part is that it looks like success from the outside: no error, no bucket, no observability signal, and the degradation is invisible.", ten: "The model response either passes `generatedCvDraftSchema` in full or fails with a specific error bucket and reporter location. There are no silent substitutions. If a PR intentionally introduces partial behavior, such as optional warnings, that behavior is expressed in the schema as an explicitly optional field with a comment explaining why, not hidden in a call-site `try/catch`. F-02 privacy still holds: draft contents, prompts, and raw model responses do not leak into logs or error text." },
  },
  {
    number: 3,
    key: "falsifiableTests",
    slug: "falsifiable-tests",
    title: "Tests that can fail",
    name: "Tests that can fail",
    rubric: { one: "A test asserts its own mock: `fake-supabase` returns a prepared response, `cv-generation` is mocked wholesale, and the assertion only verifies that the mock value came back. A mutation in the real module would not kill that test. The same score applies to assertions on exact copy text, such as `expect(msg).toBe(\"Generation failed\")`, which break on copy edits without proving behavior and train maintainers to fix the test instead of the code. It also applies when only the happy path is covered while 429s, 25-second timeouts, truncated model responses, database errors, and another user's owner boundary are not touched by any test.", ten: "Every new behavior branch has a test that would fail if that branch broke: error paths are tested alongside success. Mocks sit at process boundaries, such as OpenAI HTTP and the Supabase client, not on top of the project's own logic; the real module code remains under test. Assertions check behavior and error identifiers or buckets, not exact copy. For a nontrivial module, a targeted Stryker run over the changed lines leaves no surviving mutants in the new logic. A matching `R-NN` row is added to `context/foundation/test-plan.md` for larger changes; tiny edits do not require one." },
  },
  {
    number: 4,
    key: "provenAccessBoundary",
    slug: "proven-access-boundary",
    title: "Proven access boundary",
    name: "Proven access boundary",
    rubric: { one: "Two separate problems each earn this score. First, `user_id` comes from the wrong place: the request body, a query parameter, a `session` without `auth.getUser()`, or a client-provided id passed to the repository as the owner. In that case the policies no longer matter; the code is asking the database about someone else's rows under the wrong identity. Second, a new table or access path appears, the migration says `enable row level security` and adds policies, and the PR stops there. Nobody has proven that the policy rejects another user; it remains an author claim, not a fact.", ten: "Owner id always comes from verified `auth.getUser()` and is never accepted from the client; the diff shows where it came from. Every new table or access path has a pgTAP test in `supabase/tests/database/` that impersonates another `user_id`, tries to read, update, and delete a row, and receives zero rows or an error. Migration policies are granular, per-operation policies with `using` and `with check` wherever both are needed. The fence around `SUPABASE_SECRET_KEY` is not widened, and a service-role client does not appear where a normal client worked before." },
  },
  {
    number: 5,
    key: "layeringAndReadability",
    slug: "layering-and-readability",
    title: "Layering, duplication and cost of reading",
    name: "Layering, duplication and cost of reading",
    rubric: { one: "Logic leaks into the route: `src/pages/api/cv/generate.ts` gains retries, branching over draft contents, or direct Supabase calls around `cv-repository`. Nearby, the same PR creates a second source of truth: custom validation instead of `cvAnswersSchema`, custom error mapping instead of `generationErrorMessages`, or a query that bypasses the repository. A new dependency is added to `package.json` for something that can be solved in ten lines, and it may turn out to be Node-only in the Workers runtime. Non-obvious decisions are not marked; a month later it is unclear why the constraint is unusual and which file owns the rule.", ten: "Routes stay thin: zod validation, service call, envelope mapping. Logic lives in `src/lib/services/`, copy lives in `*-messages.ts` or `*-copy.ts`, and database access goes through the repository. Existing schemas, messages, and repositories are reused instead of duplicated; the PR does not create a second source of truth. A new dependency appears only when it cannot reasonably be replaced, and it is compatible with Workers. Every non-obvious decision has a comment at the choice point, such as `// minItems is intentionally absent because strict mode rejects it`, not a general retelling of what the code does. If the PR changes a rule rather than just code, such as a new fence, command, or test placement convention, `CLAUDE.md` or `README.md` is updated." },
  },
] as const;

export type Criterion = (typeof CRITERIA)[number];
export type CriterionKey = Criterion["key"];
export type CriterionSlug = Criterion["slug"];

/** Allowed values of `finding.category` — a finding always names one criterion. */
export const CRITERION_SLUGS = [
  "contract-sync",
  "honest-failure",
  "falsifiable-tests",
  "proven-access-boundary",
  "layering-and-readability",
] as const;

/** One 1–10 score per criterion, each carrying its rubric as the description. */
export const scoresSchema = z.object({
  contractSync: z.number().int().describe("Criterion 1. Contract synchrony. Integer from 1 to 10.\n\nScore 1. A PR changes `generatedCvDraftSchema` by adding a field, changing a type, or removing optionality, but does not update `DRAFT_CONTENT_JSON_SCHEMA`. Strict mode, with its `additionalProperties: false`, keeps returning the old shape; the new field silently does not reach validation, and zod either applies a default or never sees the field. Tests stay green, logs stay quiet, and the defect is noticed in the browser a week later. The same score applies when a migration changes a column or constraint while `database.types.ts` is not regenerated, or when application code still relies on an invariant the database schema no longer enforces.\n\nScore 10. Draft shape changes land in one PR across every representation: zod schema, OpenAI JSON Schema, and TypeScript types. The diff shows the related edits next to each other, and a reviewer can verify in about ten seconds that the shapes match. If the PR touches the database, the migration and regenerated `database.types.ts` are in the same PR, and the migration comments state what the constraint, trigger, or policy guarantees so the application does not duplicate that rule and drift from it. Ideally, drift is impossible because one shape is derived from another instead of being rewritten by hand."),
  honestFailure: z.number().int().describe("Criterion 2. Honest failure. Integer from 1 to 10.\n\nScore 1. A PR adds salvage logic around generation: `.partial()` on `generatedCvDraftSchema`, `.catch(() => fallback)`, defaults for sections the model did not return, or partial parsing that keeps whatever happened to parse. The user receives a CV with an empty experience section or an invented placeholder instead of an honest error. The worst part is that it looks like success from the outside: no error, no bucket, no observability signal, and the degradation is invisible.\n\nScore 10. The model response either passes `generatedCvDraftSchema` in full or fails with a specific error bucket and reporter location. There are no silent substitutions. If a PR intentionally introduces partial behavior, such as optional warnings, that behavior is expressed in the schema as an explicitly optional field with a comment explaining why, not hidden in a call-site `try/catch`. F-02 privacy still holds: draft contents, prompts, and raw model responses do not leak into logs or error text."),
  falsifiableTests: z.number().int().describe("Criterion 3. Tests that can fail. Integer from 1 to 10.\n\nScore 1. A test asserts its own mock: `fake-supabase` returns a prepared response, `cv-generation` is mocked wholesale, and the assertion only verifies that the mock value came back. A mutation in the real module would not kill that test. The same score applies to assertions on exact copy text, such as `expect(msg).toBe(\"Generation failed\")`, which break on copy edits without proving behavior and train maintainers to fix the test instead of the code. It also applies when only the happy path is covered while 429s, 25-second timeouts, truncated model responses, database errors, and another user's owner boundary are not touched by any test.\n\nScore 10. Every new behavior branch has a test that would fail if that branch broke: error paths are tested alongside success. Mocks sit at process boundaries, such as OpenAI HTTP and the Supabase client, not on top of the project's own logic; the real module code remains under test. Assertions check behavior and error identifiers or buckets, not exact copy. For a nontrivial module, a targeted Stryker run over the changed lines leaves no surviving mutants in the new logic. A matching `R-NN` row is added to `context/foundation/test-plan.md` for larger changes; tiny edits do not require one."),
  provenAccessBoundary: z.number().int().describe("Criterion 4. Proven access boundary. Integer from 1 to 10.\n\nScore 1. Two separate problems each earn this score. First, `user_id` comes from the wrong place: the request body, a query parameter, a `session` without `auth.getUser()`, or a client-provided id passed to the repository as the owner. In that case the policies no longer matter; the code is asking the database about someone else's rows under the wrong identity. Second, a new table or access path appears, the migration says `enable row level security` and adds policies, and the PR stops there. Nobody has proven that the policy rejects another user; it remains an author claim, not a fact.\n\nScore 10. Owner id always comes from verified `auth.getUser()` and is never accepted from the client; the diff shows where it came from. Every new table or access path has a pgTAP test in `supabase/tests/database/` that impersonates another `user_id`, tries to read, update, and delete a row, and receives zero rows or an error. Migration policies are granular, per-operation policies with `using` and `with check` wherever both are needed. The fence around `SUPABASE_SECRET_KEY` is not widened, and a service-role client does not appear where a normal client worked before."),
  layeringAndReadability: z.number().int().describe("Criterion 5. Layering, duplication and cost of reading. Integer from 1 to 10.\n\nScore 1. Logic leaks into the route: `src/pages/api/cv/generate.ts` gains retries, branching over draft contents, or direct Supabase calls around `cv-repository`. Nearby, the same PR creates a second source of truth: custom validation instead of `cvAnswersSchema`, custom error mapping instead of `generationErrorMessages`, or a query that bypasses the repository. A new dependency is added to `package.json` for something that can be solved in ten lines, and it may turn out to be Node-only in the Workers runtime. Non-obvious decisions are not marked; a month later it is unclear why the constraint is unusual and which file owns the rule.\n\nScore 10. Routes stay thin: zod validation, service call, envelope mapping. Logic lives in `src/lib/services/`, copy lives in `*-messages.ts` or `*-copy.ts`, and database access goes through the repository. Existing schemas, messages, and repositories are reused instead of duplicated; the PR does not create a second source of truth. A new dependency appears only when it cannot reasonably be replaced, and it is compatible with Workers. Every non-obvious decision has a comment at the choice point, such as `// minItems is intentionally absent because strict mode rejects it`, not a general retelling of what the code does. If the PR changes a rule rather than just code, such as a new fence, command, or test placement convention, `CLAUDE.md` or `README.md` is updated."),
});

export type Scores = z.infer<typeof scoresSchema>;
