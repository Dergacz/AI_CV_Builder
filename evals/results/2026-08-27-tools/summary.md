# Run 2026-08-27 (Tools) - Incomplete

**The full suite could not run because the OpenRouter key ran out of credit.** Out of
21 cells, only 2 were measured. This report contains only what was actually measured and
keeps the missing evidence explicit.

## What Happened

| Run | Cells | With response | Outcome |
| --- | ---: | ---: | --- |
| Control, without tools (02 and 05 x 3 models) | 6 | **6** | valid |
| Full suite with tools, `-j 4` | 21 | **2** | 19 cells got OpenRouter 402 |
| Full suite with tools, `-j 1`, maxTokens 4096 | 21 | 0 | 16 x 402, 3 x deepseek parse failure, 2 x empty |
| Cheap models only, `-j 1` | 14 | 0 | 14 x 402 |

402: `This request would exceed your available credits given your current in-flight
requests`. OpenRouter reserves each request as `max_tokens x output price` plus input; the
tool loop sends accumulated context on every step, so the reserve grows step by step.
Lowering `maxTokens` from 8192 to 4096 and using `-j 1` did not remove the problem.

Key balance: $2.494 available before the run, $1.026 after. **Failed attempts consumed
about $1.47 and produced no measured cells.** A full suite with tools costs roughly $2.2
(opus about $0.25 x 7), so it did not fit the remaining balance from the start. That should
have been calculated before running, not after.

## What Was Measured

### Control Without Tools (valid, 6 cells)

| Fixture | opus-4.8 | gpt-5.4-mini | deepseek-v3.2 |
| --- | :---: | :---: | :---: |
| 02 contract drift | PASS $0.1280 15.3s | FAIL $0.0126 3.0s | FAIL $0.0013 6.7s |
| 05 warning-code drift | PASS $0.1270 15.0s | FAIL $0.0023 1.7s | FAIL $0.0002 6.1s |

This reproduces the diagnosis from `../2026-08-27/summary.md` with the current prompt and
current harness: only opus catches both fixtures. One step, no tools.

### With Tools (2 valid cells, both gpt-5.4-mini)

| Fixture | Outcome | Steps | Tokens | Cost | Time |
| --- | :---: | --- | ---: | ---: | ---: |
| 02 contract drift | **PASS** | `readRelatedContracts` -> `readRelatedContracts` -> stop | 59,601 | $0.0169 | 7.0s |
| 03 missing RLS | **PASS** | `readRelatedContracts` -> `readReviewCriteria` x2 -> stop | 76,430 | $0.0115 | 7.8s |

The assertion for 02 passed with wording that identified the
`public.feedback.comment` check constraint still enforcing the old limit. That constraint
was not in the diff; the model named it after reading it through the tool.

### Manual Run Outside promptfoo

`google/gemini-3.7-flash` on fixture 05 through the CLI: 2 steps. The first step was
`readRelatedContracts`, and the second was the answer. It found the `date_gaps` drift from
`draftWarningCodeSchema`, set `contractSync: 2`, and returned `request-changes`. The same
model found nothing on fixture 01 before tools and nothing on 05 without tools.

## Hypothesis: Cheap Models Failed on Input, Not Capability

**Confirmed by the measured cells, but not proven.**

Direct A/B on one cell with everything else equal:

| gpt-5.4-mini, fixture 02 | without tools | with tools |
| --- | :---: | :---: |
| result | FAIL | **PASS** |
| cost | $0.0126 | $0.0169 (+34%) |
| time | 3.0s | 7.0s (+133%) |
| steps | 1 | 3 |

Plus `gemini-3.7-flash` on fixture 05. Both cells exercise exactly the mechanism the tool
was built for: the model read the missing side of the contract and found what it previously
missed.

Missing evidence needed for a definitive answer:

- deepseek with tools on 02 and 05: no measured cells;
- gpt-5.4-mini with tools on 05: not measured;
- regressions: 01, 04, 06, and 07 with tools were not run on any model except the green
  gpt-5.4-mini/03 cell;
- opus with tools: no measured cells.

## Separate Finding: deepseek and the Tool Loop

Three cells (01, 03, 04) failed for a reason other than credit: `No object generated: could
not parse the response`. This was not a 402 and not random. `deepseek-v3.2` breaks
structured output when the request includes tool definitions and tool-call history. On the
single-step control path, deepseek returned parseable JSON in every cell. **For the
cheapest model, tools are currently a regression, not an improvement.**

## Recommendation

Do not revert, but do not enable tools in the gate until the full suite has run.

The scenario "quality did not improve while cost increased" was not confirmed: on the
measured A/B, quality improved from FAIL to PASS at +34% cost. That is a good trade if it
holds on the other fixtures. The narrow single-step loop remains a working MVP and has two
advantages right now: it is cheaper, and it does not break deepseek.

To close the question: add about $3 of credit and run
`npx promptfoo eval --config evals/promptfooconfig.yaml -j 1`, plus the control
`--config evals/promptfooconfig.control.yaml` for comparison on the same fixtures.
