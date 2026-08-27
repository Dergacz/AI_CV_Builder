# @10x/code-reviewer

Entry point for AI code review: **AI SDK 7** + **OpenRouter** + **zod**, TypeScript on
Node without a build step.

## Installation

```bash
npm install
cp .env.example .env   # fill in OPENROUTER_API_KEY
```

## Running

```bash
npm start -- src/index.ts        # review a file
npm start -- src/index.ts --json # machine-readable output
git diff | npm start -- --json   # review a diff from stdin
npm run dev                      # tsx watch
npm run typecheck                # tsc --noEmit
```

The entry point runs both through `tsx` and through native Node 22+ type stripping
(`node src/index.ts`); `erasableSyntaxOnly` is enabled in `tsconfig.json`.

## Programmatic Use

```ts
import { reviewCode, formatReview } from "./src/index.ts";

const { review, usage } = await reviewCode({
  code: await readFile("src/app.ts", "utf8"),
  path: "src/app.ts",
  context: "Astro SSR, zod 4, strict TS",
});

console.log(review.verdict); // "approve" | "comment" | "request-changes"
console.log(review.findings); // validated zod array of findings
```

`reviewCode` uses the model from `OPENROUTER_MODEL` by default. Pass any other model, or
a custom provider, as the second argument:

```ts
import { createProvider } from "./src/index.ts";

const { provider } = createProvider();
await reviewCode(input, { model: provider("openai/gpt-5.6-terra"), temperature: 0 });
```

## Environment Variables

| Variable              | Required | Default                   |
| --------------------- | -------- | ------------------------- |
| `OPENROUTER_API_KEY`  | yes      | -                         |
| `OPENROUTER_MODEL`    | no       | `google/gemini-3.7-flash` |
| `OPENROUTER_APP_NAME` | no       | `10x-code-reviewer`       |
| `OPENROUTER_APP_URL`  | no       | -                         |

Validation uses zod (`src/env.ts`); on error the process exits with a clear message.

## Files

| File                | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `src/index.ts`      | public exports plus CLI                                            |
| `src/review.ts`     | zod review schema and `reviewCode()` (`generateText` + `Output.object`) |
| `src/openrouter.ts` | OpenRouter provider and default model                              |
| `src/env.ts`        | environment schema and loading                                     |

## Version Notes

AI SDK 7 is ESM-only and requires Node >= 22. `system` was renamed to `instructions`, and
structured output is implemented through `generateText` + `Output.object()` instead of the
older `generateObject`. Current docs live in `node_modules/ai/docs/` and match the
installed version.
