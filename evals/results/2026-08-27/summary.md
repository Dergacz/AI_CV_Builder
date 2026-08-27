# Run 2026-08-27

First run after fixing the criteria -> schema -> prompt wiring: the five criteria from
`context/review-criteria.md` are generated into `criteria.generated.ts`, the 1/10 rubrics
live in each `scores` field `.describe()`, and `finding.category` is an enum of the five
slugs.

Prompt commit: working tree on `dev` (not committed at run time). `assertions.ts`,
fixtures, and `.expected.md` files were unchanged.

## Matrix

| Provider      | Model                       | Tests | Passed | Cost | Average cost | Average time |
| ------------- | --------------------------- | ----: | -----: | ---: | -----------: | -----------: |
| opus-4.8      | `anthropic/claude-opus-4.8` |     6 |  **5** | $0.8015 | $0.1336 | 17.1 s |
| gpt-5.4-mini  | `openai/gpt-5.4-mini`       |     6 |  **3** | $0.0289 | $0.0048 | 2.8 s |
| deepseek-v3.2 | `deepseek/deepseek-v3.2`    |     6 |  **3** | $0.0045 | $0.0008 | 12.0 s |
| **total**     |                             | **18** | **11** (61.1%) | **$0.8350** | | 1 m 23 s (concurrency 4) |

Tokens: 260,421 per run (250,740 prompt / 9,681 completion) plus 17,406 for the judge.
Cost is the actual OpenRouter charge (`usage.cost`), not an estimate.

In the raw output, provider labels still included prices such as `opus-4.8 ($5 / $25)`.
That run started before prices moved into comments in `promptfooconfig.yaml`. The table
above uses the new labels; the models are the same.

## By Case

| Fixture               | opus-4.8 | gpt-5.4-mini | deepseek-v3.2 |
| --------------------- | :------: | :----------: | :-----------: |
| 01 clean              | FAIL `javascript` + `llm-rubric` | PASS | PASS |
| 02 contract drift     | PASS | FAIL `javascript` | FAIL `javascript` |
| 03 missing RLS        | PASS | PASS | PASS |
| 04 vacuous test       | PASS | FAIL `javascript` | FAIL `llm-rubric` |
| 05 warning-code drift | PASS | FAIL `javascript` | FAIL `javascript` |
| 06 salvage draft      | PASS | PASS | PASS |

`is-json` passed in all 18 cells, so the output shape was usable for the gate across all
three models, including the new required `scores` object.

## What Changed Since the Previous Run

The suite moved from 6/18 to 11/18. The gain came entirely from two fixtures: 03 (RLS) and
06 (honest failure) are now caught by all three models, while the earlier suite was almost
entirely red. The hypothesis that "the red suite came from a generic prompt paired with
project-specific assertions" was confirmed, but not fully: two of the five criteria,
contract synchrony on fixtures 02 and 05, are still missed by the cheap models.

## Failed Case Analysis

Categories: **A** means the agent truly missed the issue, because of prompt, criteria, or
input; **B** means the agent found it but the wording missed the assertion; **C** means
the expectation does not match what a good reviewer should notice.

| # | Cell | Category | Rationale |
| -: | ---- | :------: | --------- |
| 1 | opus-4.8 / 01 clean | **C** | The finding is substantively correct: the comment promises "well inside the 255-byte limit", but `truncateStem` truncates by characters, and 80 CJK characters can reach 320 bytes. The fixture was not as clean as its expectation claimed. |
| 2 | gpt-5.4-mini / 02 | **A** | Returned `approve` with zero findings and 10s for all criteria: the drift between the zod 2000-character limit and the 1000-character check constraint was simply missed. |
| 3 | deepseek-v3.2 / 02 | **A** | Same outcome: `approve`, zero findings; the opposite side of the contract was outside the diff, and the model did not infer it. |
| 4 | gpt-5.4-mini / 04 | **A** | Set `falsifiableTests: 7` and returned no finding. The prompt only required a finding for scores <= 3, so the model slipped through the 4-7 gap legally. |
| 5 | deepseek-v3.2 / 04 | **A** | It caught the defect (`javascript` passed), but the third finding used `line: null` and lacked an identifier from the diff, violating the grounding rule in the prompt. This is a prompt/schema issue, not an assertion issue. |
| 6 | gpt-5.4-mini / 05 | **A** | `approve`, zero findings: the new `date_gaps` value in JSON Schema and prompt was not matched against the zod enum, which was outside the diff. |
| 7 | deepseek-v3.2 / 05 | **A** | Identical: zero findings and 10s across all five criteria. |

No cell fell into category **B**. Whenever a model named the defect, the regex caught it.
This run did not reveal assertion defects.

Six of seven failures are category **A**, grouped into three different causes:

1. **Input, not wording** (cases 2, 3, 6, 7). Fixtures 02 and 05 require a file missing
   from the diff: the older migration with `check (char_length(comment) <= 1000)` and the
   zod enum of warning codes. Opus inferred the missing side from knowing it had to exist;
   `gpt-5.4-mini` and `deepseek` did not. Prompt wording is unlikely to fix this; adding
   referenced files to context would.
2. **Gap between score and finding consistency** (case 4). The prompt links findings to
   scores only at the ends of the scale: <= 3 requires a finding, >= 8 does not. A score of
   7 with no finding is formally allowed.
3. **Grounding rule is not mandatory enough** (case 5). "Every finding names a place" is
   a norm, but `line: null` is allowed by schema and the model used that space.

None of that was fixed in this session; this file only classified the run.
