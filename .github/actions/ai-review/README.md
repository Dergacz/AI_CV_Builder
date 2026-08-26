# `ai-review` composite action

Runs the [`@10x/code-reviewer`](../../../packages/code-reviewer) agent over a unified
diff, posts the result to a pull request, and reports a `pass`/`fail` verdict.

The action owns the *review*; the calling workflow owns *when to review* and *what to do
with the answer*. That split is deliberate — an action can be moved to its own repository
and versioned independently, a workflow cannot.

## Prerequisites

- **Node on `PATH`.** The action runs `npm ci` and the agent, but does not install Node —
  the node version is a repository-level decision (here, `.nvmrc`), so the caller sets it up.
- **`jq` and `gh`.** Both are preinstalled on GitHub-hosted runners.
- **Labels must already exist** in the repository (`ai-cr:passed`, `ai-cr:failed`,
  `ai-cr:review`). Creating a label needs `issues: write`, which this action deliberately
  does not ask for; a missing label degrades to a warning rather than a failure.

## Inputs

| Input | Required | Default | Notes |
| --- | --- | --- | --- |
| `diff-path` | yes | — | Path to the diff file. A **path**, not the diff itself: multi-line content in an action input breaks on quotes and backslashes. |
| `api-key` | yes | — | OpenRouter key. Always a secret. |
| `reviewer-dir` | no | `packages/code-reviewer` | Must hold `package.json` + `package-lock.json`. |
| `model` | no | *(agent default)* | Any OpenRouter model id. |
| `pr-number` | no | `''` | Empty ⇒ review only, no comment and no labels. This is what makes `workflow_dispatch` runs work. |
| `pr-title` / `pr-body` | no | `''` | Passed to the model as context. |
| `github-token` | no | `''` | Needed only when `pr-number` is set. |
| `fail-on` | no | `request-changes` | Comma-separated model verdicts that map to `fail`. |
| `max-diff-bytes` | no | `200000` | Larger diffs are truncated before they cost tokens. |
| `comment-marker` | no | `<!-- ai-cr:review -->` | Identifies the comment to update. Give two instances distinct markers so they don't overwrite each other. |

## Outputs

| Output | Value |
| --- | --- |
| `verdict` | `pass` \| `fail` — the gate signal |
| `raw-verdict` | the model's own `approve` \| `comment` \| `request-changes` |
| `findings-count` | number of findings |
| `report-path` | raw JSON report on disk |

## Design notes

- **The action never fails on a `fail` verdict.** It sets an output and returns success, so
  the comment and labels are always written. Failing the build is the caller's job — see the
  `Enforce verdict` step in `ai-review.yml`. An action that failed early would gate the PR
  without ever telling the author why.
- **An agent crash is not a review rejection.** If the agent exits non-zero (bad key, API
  outage, malformed JSON) the step fails outright rather than reporting `fail`, so
  infrastructure problems don't read as "your code is bad".
- **Untrusted input never reaches a shell.** PR titles and bodies are attacker-controlled;
  every one is passed through `env:` and written to a file, never interpolated into a
  `run:` block.
- **`ai-cr:review` is cleared with `if: always()`.** Re-adding a label that is already
  present emits no event, so a crashed run that kept the label would leave the PR unable
  to retrigger.

## Verdict mapping

The agent's schema (`packages/code-reviewer/src/criteria.ts`) emits
`approve | comment | request-changes`. `fail-on` collapses those three into the binary
`pass`/`fail` that a branch protection gate needs.
