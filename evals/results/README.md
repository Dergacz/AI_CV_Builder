# Suite Runs

One directory per run: `evals/results/<YYYY-MM-DD>/`.

| File                   | What it contains |
| ---------------------- | ---------------- |
| `summary.md`           | provider x result matrix, changes since the previous run, and failed-case analysis |
| `results.json`         | machine output from promptfoo (`--output`): every model response, every assertion, tokens, and cost |
| `promptfoo-output.txt` | raw stdout from the run: the table and final line as the terminal saw them |

## Why This Is in Git

`~/.promptfoo/promptfoo.db` lives on one machine, can be cleaned, and does not survive a
laptop change. The question "did this get better or worse after the prompt change?"
requires the previous baseline, and that baseline must live in the repository next to the
prompt commit that produced it. The dated directory is that baseline.

Runs are not byte-for-byte reproducible: models are nondeterministic even at
`temperature: 0.2`, and OpenRouter prices change. Store the result, not a promise that it
can be repeated exactly.

## Adding a New Run

```sh
export OPENROUTER_API_KEY=...
mkdir -p evals/results/$(date +%F)
npx promptfoo eval --config evals/promptfooconfig.yaml \
  --output evals/results/$(date +%F)/results.json \
  | tee evals/results/$(date +%F)/promptfoo-output.txt
```

Then write `summary.md` manually using the previous one as the template.
