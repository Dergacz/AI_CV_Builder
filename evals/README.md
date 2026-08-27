# Evals: Comparing Models on Code Review

## Why This Suite Exists

The review prompt (`REVIEW_INSTRUCTIONS` in `packages/code-reviewer/src/criteria.ts`)
decides whether a PR passes the gate. Editing one line changes behavior across every
input, and running the agent on the current PR only shows one response to one diff. This
suite fixes seven diffs with known expectations (`fixtures/*.expected.md`) and runs them
against three models at different price points: expensive reasoning, mid-range, and cheap.
After every prompt change, the suite shows whether a model stopped catching what it caught
before, and whether a cheaper model performs well enough for CI. The prompt and schema are
**imported** from `criteria.ts`, not copied, so they cannot drift from what actually runs
in `packages/code-reviewer`.

## Current Suite State

**Latest run: 2026-08-27 - 11/18 (61%).** Full matrix and failure analysis:
[`results/2026-08-27/summary.md`](results/2026-08-27/summary.md).

|           | opus-4.8 | gpt-5.4-mini | deepseek-v3.2 |
| --------- | :------: | :----------: | :-----------: |
| passed    |   5/6    |     3/6      |      3/6      |
| run cost  |  0.8015  |    0.0289    |    0.0045     |

Before criteria from `context/review-criteria.md` were connected to the schema and prompt,
the suite scored 6/18: the prompt asked for generic review while the assertions checked
project-specific issues. That wiring is fixed. The gain came from fixtures 03 (RLS) and
06 (honest failure), which all three models now catch.

What remains red: **contract synchrony on cheap models**. Fixtures 02 and 05 require a
file outside the diff: an older migration and a zod enum. `gpt-5.4-mini` and `deepseek`
return `approve` with zero findings on those cases. Opus catches both. The practical CI
answer is that only opus-4.8 is acceptable today; there is no cheaper option backed by
the current data.

The only opus failure is fixture 01, where the model is right and the old expectation was
wrong: the code comment promises a byte limit while `truncateStem` truncates by characters.

## Running

```sh
export OPENROUTER_API_KEY=...   # same key as packages/code-reviewer
npm run eval                    # full run, about $0.84 measured on 2026-08-27
npm run eval:view               # browser report: findings, tokens, actual cost
```

The run became about five times more expensive than the first measurement (about $0.17):
criterion rubrics are sent on every request as `scores` field descriptions, and the prompt
portion grew to about 14k tokens per call. Almost the whole bill is opus: $0.80 out of
$0.84.

Save run results in git under `evals/results/<date>/`; see
[`results/README.md`](results/README.md). The promptfoo database lives in `~/.promptfoo/`.
CI and other machines do not have it, and "did this get better or worse?" cannot be
answered without a versioned baseline.

Useful debugging flags: `-n 1` for the first fixture only, `--filter-pattern "^03"` for
one fixture, `--filter-providers deepseek` for one model, and `--no-cache`.

## When the Suite Turns Red: Classify First, Then Fix

**A red cell is not automatically an agent defect.** Before touching the prompt, classify
the failure into one of three categories. The order matters: changing the prompt after
misreading a failure makes the system worse twice, by leaving the real cause in place and
changing behavior on every other fixture.

| Category | What it looks like | What to fix |
| -------- | ------------------ | ----------- |
| **A. Agent missed it** | No finding exists, or the verdict is `approve` with high scores for a violated criterion | Prompt, criteria, or **input**; see below |
| **B. Agent found it, regex missed it** | The defect is described in `summary` or `suggestion`, but not with words `assertions.ts` searches for | Assertion wording, without weakening the condition |
| **C. Expectation is wrong** | The finding is substantively correct, while `.expected.md` says there should be no finding | Fixture and `.expected.md` |

To distinguish A from B in thirty seconds, open `npm run eval:view`, find the cell, and
read the raw JSON response instead of only the `reason` string. If `findings` contains a
finding about the right location, it is B. If `findings` is empty or about another issue,
it is A.

C can only be recognized by reading the fixture diff yourself. It costs more time and is
therefore the easiest step to skip.

### Why This Rule Exists

In the 2026-08-27 run, opus-4.8 "failed" fixture 01, then named
`01-clean-filename-length-cap`, which expected no findings. The model found that the diff
comment promised safety against a 255-byte filename limit while the truncation was by
characters. The model was right. The suite punished the attentive model and rewarded the
two cheaper models that missed the issue.

That was category C. Treating it as A and "fixing" the prompt with a rule like "do not
nitpick comments" would have made the agent worse on every other fixture while leaving the
real issue in the repository. The fixture was renamed to `01-filename-cap-byte-claim` and
reclassified as "looks clean, but is not"; `07-clean-cv-notes-table` is now the clean PR.

The same run had no category B failures: whenever the model named the defect, the regex
caught it. That is useful calibration. If several assertions appear to fail at once, the
more likely cause is A, not a set of bad regexes.

### Inside Category A: Prompt or Input?

This is the branch that costs the most when skipped. Ask: **was the answer available from
what the agent saw?**

- If yes, the prompt or criteria are defective.
- If no, because the answer needs a file outside the diff, the defect is in the **input**;
  the prompt cannot solve it.

This happened with fixtures 02 and 05. Both require a file outside the diff: an old
migration and a zod enum. Only the most expensive model caught them because it inferred the
missing side from general knowledge. The fix is `readRelatedContracts`, not new prompt
wording.

## Investigating a Failed Assertion

1. `npm run eval:view` shows which of the three assertion types failed and on which
   fixture.
2. Identify the failed assertion:
   - **`is-json`**: the model stopped returning a parseable object of the expected shape.
     This is about gate usability, not review quality. Fix the output contract in
     `prompt.ts` or change the model.
   - **`javascript`**: the model did not find the defect the fixture exists to measure.
     The condition lives in `assertions.ts`; the expected answer in words lives in
     `fixtures/NN-*.expected.md`.
   - **`llm-rubric`**: the defect was found, but the rationale is generic and lacks a
     file, line, or symbol from the diff.
3. **Check whether it is flaky.** Runs are not fully deterministic: in measurements, the
   same model changed its verdict for fixture 05 between runs. The threshold here is
   strict, so one flipped case turns the whole run red. Before changing the prompt, repeat
   the failing case:
   `npm run eval -- --filter-pattern "^05" --repeat 3 --no-cache`. If it is stably red,
   continue. If it flips, solve model variance, temperature, or model choice instead of
   rewriting the assertion.
4. The next branch matters most: **did the change make review worse, or did the assertion
   describe the wrong thing?** If `.expected.md` is still right, fix the prompt. If behavior
   intentionally changed, update `.expected.md` first and only then the assertion, so the
   new expectation is written in prose before it becomes a regex. The same applies to
   category C: expected prose first, assertion second.
5. Do not lower the threshold. It is intentionally default-strict: one failed assertion
   fails the run. A green report obtained by weakening assertions does not prove anything.

## Things to Know

- Fixtures carry their answer after `--- FIXTURE METADATA`; `prompt.ts` strips it before
  sending the input to the model.
- The model request mirrors the CLI path: the system prompt is exactly
  `REVIEW_INSTRUCTIONS`, and the schema is sent through
  `response_format: {type: json_schema, strict: true}` exactly as AI SDK `Output.object()`
  sends it. Without this, `is-json` would fail on prose preambles that production never
  sees.
- The judge for `llm-rubric` is `anthropic/claude-sonnet-4.6`, intentionally outside the
  three tested models so no model judges itself.
- `openrouter-provider.ts` exists because promptfoo's built-in provider calculates cost
  from bare OpenAI identifiers, misses slugs such as `anthropic/claude-opus-4.8`, and shows
  an empty cost column. The custom provider asks OpenRouter for `usage: { include: true }`
  and returns `usage.cost` as-is.
- The same provider unwraps responses fully enclosed in a code fence as a fallback for
  models without strict-mode support. With `response_format`, this usually does not run.
  Prose answers still fail, and that is correct.
