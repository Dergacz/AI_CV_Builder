import { createModel } from "../packages/code-reviewer/src/openrouter.ts";
import { reviewCode } from "../packages/code-reviewer/src/review.ts";

/**
 * promptfoo provider that runs the ACTUAL reviewer, tool loop and all.
 *
 * `openrouter-provider.ts` sends one blind HTTP call. That was a faithful model of
 * the gate while the gate was one blind call; it stopped being one when the reviewer
 * gained `readRelatedContracts`, because the whole question — does fetching the other
 * side of a contract help — is invisible to a harness that cannot fetch. So this
 * provider calls `reviewCode` and grades what production actually does.
 *
 * `tools: false` runs the same prompt with the loop switched off, which is how the
 * tools get measured against their own absence rather than against last week's run.
 */

interface AgentConfig {
  /** Any id from https://openrouter.ai/models */
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Defaults to true; false is the no-tools control. */
  tools?: boolean;
  /** Hard ceiling on model calls per review. */
  maxSteps?: number;
}

/** promptfoo hands a prompt-function's message array over JSON-encoded. */
function extractDiff(prompt: string): string {
  try {
    const parsed: unknown = JSON.parse(prompt);
    if (Array.isArray(parsed)) {
      const user = (parsed as { role?: string; content?: string }[]).find((m) => m.role === "user");
      if (user?.content !== undefined) return user.content;
    }
  } catch {
    // Not JSON — a model-graded assertion sending plain text.
  }

  return prompt;
}

export default class ReviewAgentProvider {
  private readonly config: AgentConfig;

  constructor(options: { config?: AgentConfig } = {}) {
    if (!options.config?.model) {
      throw new Error("agent-provider requires `config.model`, e.g. anthropic/claude-opus-4.8");
    }

    this.config = options.config;
  }

  id(): string {
    return `agent:${this.config.model}${this.config.tools === false ? ":no-tools" : ""}`;
  }

  async callApi(prompt: string) {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return { error: "OPENROUTER_API_KEY is not set — see evals/README.md." };
    }

    const model = createModel(this.config.model);

    const steps: string[] = [];

    try {
      const result = await reviewCode(
        { code: extractDiff(prompt) },
        {
          model,
          temperature: this.config.temperature ?? 0.2,
          maxOutputTokens: this.config.maxTokens ?? 8192,
          maxSteps: this.config.maxSteps ?? 6,
          useTools: this.config.tools !== false,
          // Captured rather than printed: promptfoo runs four cases at once and
          // interleaved stderr from four reviews is unreadable.
          onStep: (log) =>
            steps.push(`${String(log.step)}:${log.finishReason}${log.toolCalls.length > 0 ? `(${log.toolCalls.join(",")})` : ""}`),
        },
      );

      return {
        output: JSON.stringify(result.review),
        tokenUsage: {
          prompt: result.usage.inputTokens,
          completion: result.usage.outputTokens,
          total: result.usage.totalTokens,
        },
        cost: result.cost,
        metadata: { steps: result.steps, trace: steps.join(" → ") },
      };
    } catch (error) {
      return { error: `agent failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
