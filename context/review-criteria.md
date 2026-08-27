# Pull Request Review Criteria

Five criteria used to review pull requests in this project. Each criterion is scored from
1 to 10. The criteria describe what the code must uphold, not what the current code
already guarantees; existing code can still fall short.

The criteria are equally important. Their order is only the document order used by the
generated schema.

---

## Language Invariant: English Rubrics, English Output

The rubric text below is copied verbatim into the model-facing structured output schema:
`packages/code-reviewer/scripts/generate-criteria.ts` moves each `Score 1` and `Score 10`
block into the `.describe()` text for the matching field in `scores`.

All reviewer instructions, generated schema descriptions, and free-text response fields
must be English: `summary`, `suggestion`, `symbol`, and every finding text. The prompt
enforces this at the end of `REVIEW_INSTRUCTIONS`:

> Write `summary`, `suggestion` and every other free-text field in English. The scoring
> rubrics are also English.

This is a contract, not copy style. Assertions in `evals/assertions.ts` look for English
review vocabulary such as `/rls|row level security|polic|access/`,
`/mock|tautolog|vacuous|always pass/`, and `/migration|constraint|check|database/`.
If reviewer output moves to another language, the JavaScript assertions can report that
the agent missed a defect even when the model found it in different words.

Changing the output language is therefore a contract change between prompt, schema,
`.expected.md` files, and assertions. Update the expected files first, then the assertion
logic, then the prompt/schema.

---

## 1. Contract synchrony

The same structure is described in several places: `generatedCvDraftSchema` (zod,
`src/lib/cv-draft.ts`), `DRAFT_CONTENT_JSON_SCHEMA` (the OpenAI strict-mode JSON Schema,
`src/lib/services/cv-generation.ts`), TypeScript types inferred from zod, migrations in
`supabase/migrations/`, and generated `src/db/database.types.ts`. This criterion checks
whether those descriptions move together.

**Score 1.** A PR changes `generatedCvDraftSchema` by adding a field, changing a type, or
removing optionality, but does not update `DRAFT_CONTENT_JSON_SCHEMA`. Strict mode, with
its `additionalProperties: false`, keeps returning the old shape; the new field silently
does not reach validation, and zod either applies a default or never sees the field. Tests
stay green, logs stay quiet, and the defect is noticed in the browser a week later. The
same score applies when a migration changes a column or constraint while
`database.types.ts` is not regenerated, or when application code still relies on an
invariant the database schema no longer enforces.

**Score 10.** Draft shape changes land in one PR across every representation: zod schema,
OpenAI JSON Schema, and TypeScript types. The diff shows the related edits next to each
other, and a reviewer can verify in about ten seconds that the shapes match. If the PR
touches the database, the migration and regenerated `database.types.ts` are in the same
PR, and the migration comments state what the constraint, trigger, or policy guarantees
so the application does not duplicate that rule and drift from it. Ideally, drift is
impossible because one shape is derived from another instead of being rewritten by hand.

**Why this is on the list.** This project has already hit exactly this failure mode: the
zod schema changed, the JSON Schema did not, and strict mode silently cut data. Migration
drift has been a separate recurring problem.

---

## 2. Honest failure

This covers the AI path. LLM output is nondeterministic, and `cv-generation.ts` currently
treats an invalid response as a named failure bucket rather than a "nearly valid" result.
This criterion checks whether a PR preserves that honesty.

**Score 1.** A PR adds salvage logic around generation: `.partial()` on
`generatedCvDraftSchema`, `.catch(() => fallback)`, defaults for sections the model did
not return, or partial parsing that keeps whatever happened to parse. The user receives a
CV with an empty experience section or an invented placeholder instead of an honest error.
The worst part is that it looks like success from the outside: no error, no bucket, no
observability signal, and the degradation is invisible.

**Score 10.** The model response either passes `generatedCvDraftSchema` in full or fails
with a specific error bucket and reporter location. There are no silent substitutions. If
a PR intentionally introduces partial behavior, such as optional warnings, that behavior
is expressed in the schema as an explicitly optional field with a comment explaining why,
not hidden in a call-site `try/catch`. F-02 privacy still holds: draft contents, prompts,
and raw model responses do not leak into logs or error text.

**Why this is on the list.** A PR that turns an invalid model response into a "valid"
draft with empty or invented sections instead of an honest error is unacceptable for this
project.

---

## 3. Tests that can fail

This is not about the presence of tests or coverage. It is about whether a test can catch
a real breakage.

**Score 1.** A test asserts its own mock: `fake-supabase` returns a prepared response,
`cv-generation` is mocked wholesale, and the assertion only verifies that the mock value
came back. A mutation in the real module would not kill that test. The same score applies
to assertions on exact copy text, such as `expect(msg).toBe("Generation failed")`, which
break on copy edits without proving behavior and train maintainers to fix the test instead
of the code. It also applies when only the happy path is covered while 429s, 25-second
timeouts, truncated model responses, database errors, and another user's owner boundary
are not touched by any test.

**Score 10.** Every new behavior branch has a test that would fail if that branch broke:
error paths are tested alongside success. Mocks sit at process boundaries, such as OpenAI
HTTP and the Supabase client, not on top of the project's own logic; the real module code
remains under test. Assertions check behavior and error identifiers or buckets, not exact
copy. For a nontrivial module, a targeted Stryker run over the changed lines leaves no
surviving mutants in the new logic. A matching `R-NN` row is added to
`context/foundation/test-plan.md` for larger changes; tiny edits do not require one.

**Why this is on the list.** This project has repeatedly seen all three anti-patterns:
tests that only assert mocks, assertions on exact text, and happy-path-only coverage.

---

## 4. Proven access boundary

This covers Supabase and data ownership. The project has a two-layer boundary: RLS
policies in migrations and an owner-id filter in `cv-repository.ts`. This criterion checks
whether the boundary is proven, not merely claimed.

**Score 1.** Two separate problems each earn this score. First, `user_id` comes from the
wrong place: the request body, a query parameter, a `session` without `auth.getUser()`, or
a client-provided id passed to the repository as the owner. In that case the policies no
longer matter; the code is asking the database about someone else's rows under the wrong
identity. Second, a new table or access path appears, the migration says
`enable row level security` and adds policies, and the PR stops there. Nobody has proven
that the policy rejects another user; it remains an author claim, not a fact.

**Score 10.** Owner id always comes from verified `auth.getUser()` and is never accepted
from the client; the diff shows where it came from. Every new table or access path has a
pgTAP test in `supabase/tests/database/` that impersonates another `user_id`, tries to
read, update, and delete a row, and receives zero rows or an error. Migration policies are
granular, per-operation policies with `using` and `with check` wherever both are needed.
The fence around `SUPABASE_SECRET_KEY` is not widened, and a service-role client does not
appear where a normal client worked before.

**Why this is on the list.** The critical requirements are pgTAP evidence for RLS and the
proven origin of `user_id`. Migration policies and the secret-key fence support that
boundary.

---

## 5. Layering, duplication and cost of reading

This checks whether the code will remain readable and predictable after the PR is merged,
and again a month later.

**Score 1.** Logic leaks into the route: `src/pages/api/cv/generate.ts` gains retries,
branching over draft contents, or direct Supabase calls around `cv-repository`. Nearby, the
same PR creates a second source of truth: custom validation instead of `cvAnswersSchema`,
custom error mapping instead of `generationErrorMessages`, or a query that bypasses the
repository. A new dependency is added to `package.json` for something that can be solved in
ten lines, and it may turn out to be Node-only in the Workers runtime. Non-obvious
decisions are not marked; a month later it is unclear why the constraint is unusual and
which file owns the rule.

**Score 10.** Routes stay thin: zod validation, service call, envelope mapping. Logic
lives in `src/lib/services/`, copy lives in `*-messages.ts` or `*-copy.ts`, and database
access goes through the repository. Existing schemas, messages, and repositories are
reused instead of duplicated; the PR does not create a second source of truth. A new
dependency appears only when it cannot reasonably be replaced, and it is compatible with
Workers. Every non-obvious decision has a comment at the choice point, such as
`// minItems is intentionally absent because strict mode rejects it`, not a general
retelling of what the code does. If the PR changes a rule rather than just code, such as a
new fence, command, or test placement convention, `CLAUDE.md` or `README.md` is updated.

**Why this is on the list.** Logic in routes, duplication instead of reuse, and unnecessary
dependencies have all been called unacceptable here. For documentation, the required part
is a comment at the non-obvious choice point.
