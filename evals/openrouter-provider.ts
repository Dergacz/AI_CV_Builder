import { reviewJsonSchema } from "../packages/code-reviewer/src/criteria.ts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

interface ProviderConfig {
  /** Any id from https://openrouter.ai/models */
  model: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Mirrors `Output.object({ schema: reviewSchema })` in the CLI, which makes
   * `@openrouter/ai-sdk-provider` send `response_format: {type: "json_schema",
   * strict: true}`. Without it the harness would be grading a plainer request
   * than the gate actually makes.
   */
  structuredOutput?: boolean;
}

interface ChatMessage {
  role: string;
  content: string;
}

/**
 * promptfoo hands the prompt over as a string. Prompt functions that return a
 * message array arrive JSON-encoded; model-graded assertions send plain text.
 */
function toMessages(prompt: string): ChatMessage[] {
  try {
    const parsed: unknown = JSON.parse(prompt);
    if (Array.isArray(parsed)) return parsed as ChatMessage[];
  } catch {
    // Not JSON — treat it as a single user turn.
  }

  return [{ role: "user", content: prompt }];
}

/** A fenced block, optionally tagged, wrapping the whole response. */
const FENCED = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/;

/**
 * Unwraps a response that is entirely one markdown code fence.
 *
 * The AI SDK's `Output.object()` does the same before parsing, so the CLI never
 * sees the fence. Leaving it in would fail `is-json` for a formatting habit that
 * production tolerates, which measures this harness rather than the model.
 * Anything other than a single wrapping fence is passed through untouched, so a
 * model that answers in prose still fails.
 */
function unwrapFence(text: string): string {
  const match = FENCED.exec(text.trim());
  return match?.[1] ?? text;
}

/**
 * OpenRouter provider that keeps the cost OpenRouter reports.
 *
 * promptfoo's built-in `openrouter:` provider computes cost with
 * `calculateOpenAICost`, which looks the model up in a table of bare OpenAI ids
 * (`gpt-5`, ...). A slug like `anthropic/claude-opus-4.8` misses, and the
 * lookup returns `undefined` before it would ever consult a `cost:` set in
 * config — so the report shows no dollars at all. Asking for `usage.include`
 * and passing `usage.cost` straight through gives the report the vendor's own
 * accounting instead of an estimate.
 */
export default class OpenRouterCostProvider {
  private readonly config: ProviderConfig;

  constructor(options: { config?: ProviderConfig } = {}) {
    if (!options.config?.model) {
      throw new Error("openrouter-provider requires `config.model`, e.g. anthropic/claude-opus-4.8");
    }

    this.config = options.config;
  }

  id(): string {
    return `openrouter:${this.config.model}`;
  }

  async callApi(prompt: string) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return { error: "OPENROUTER_API_KEY is not set — see evals/README.md." };
    }

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "10x-code-reviewer-evals",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: toMessages(prompt),
        temperature: this.config.temperature ?? 0.2,
        max_tokens: this.config.maxTokens ?? 4096,
        ...(this.config.structuredOutput === true
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { name: "response", strict: true, schema: reviewJsonSchema() },
              },
            }
          : {}),
        // Makes OpenRouter return what it actually charged, under `usage.cost`.
        usage: { include: true },
      }),
    });

    if (!response.ok) {
      return { error: `OpenRouter ${String(response.status)}: ${await response.text()}` };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
    };

    const usage = data.usage ?? {};

    return {
      output: unwrapFence(data.choices?.[0]?.message?.content ?? ""),
      tokenUsage: {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        total: usage.total_tokens,
      },
      // promptfoo surfaces this verbatim in the report's cost column.
      cost: usage.cost,
    };
  }
}
