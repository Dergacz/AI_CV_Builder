# AI Review Gate: Requirements

What the gate receives, what it produces, and what it judges. The implementation lives in
`.github/workflows/ai-review.yml` and `.github/actions/ai-review/`.

## Overall Concept

- GitHub Actions workflow run for every new pull request to `master`
- Composite action for the review itself, so the main workflow only prepares the diff and
  enforces the verdict, while the review step can be reused from another workflow or run
  on demand without copying its logic

## Input Parameters

- pull request title
- pull request description
- git diff

The diff is not enough by itself. The agent reads related contracts from the repository
through `readRelatedContracts`, because drift between a zod schema and a migration can be
physically invisible in a single diff. This was added after the 2026-08-27 run, where only
the most expensive model caught fixtures 02 and 05.

## Code Review Criteria

**Source of truth: [`context/review-criteria.md`](../../review-criteria.md).**

The list is intentionally not duplicated here. The five criteria from that document are
generated into `packages/code-reviewer/src/criteria.generated.ts`
(`npm run criteria:build`), the 1-10 rubrics are copied into the output schema field
descriptions, and `npm run criteria:check` fails the build when the document and generated
code drift. A second criteria list in this file would become a third description of the
same contract, which is exactly the defect criterion 1 is meant to catch.

This file used to contain six generic dimensions from the course example: correctness,
idiomaticity, complexity, test coverage, documentation, and security. They did not
describe this project and no executable file read them. They were replaced by a link to
the generated criteria source on 2026-08-27.

## Expected Side Effects

- PR comment with summary
- labels: `ai-cr:failed` (red) OR `ai-cr:passed`

The comment is rewritten in place using a marker instead of adding a new comment on every
run. The two labels are mutually exclusive: the action removes the opposite label. The
labels must already exist in the repository; the action does not create them and emits an
`::warning::` instead.

## Expected Behavior

- on-demand retry when the `ai-cr:review` label is added

The label is removed in an `always()` step after the run. Adding a label that is already
present does not create another event, so without removal the PR would be stuck after the
first retry.

The gate fails only when the verdict is `request-changes` according to the `fail-on`
input. The action itself completes successfully and exposes the verdict as an output; a
separate `Enforce verdict` step fails so that "review ran and rejected the PR" remains
distinguishable from "review did not run".
