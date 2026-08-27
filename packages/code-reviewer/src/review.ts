import { stderr } from "node:process";

import { generateText, Output, jsonSchema, stepCountIs, type LanguageModel, type LanguageModelUsage } from "ai";

import { REVIEW_INSTRUCTIONS, reviewJsonSchema, reviewSchema, type Review } from "./criteria.ts";
import { createProvider } from "./openrouter.ts";
import { reviewTools } from "./tools.ts";

/**
 * The output contract, described exactly once.
 *
 * Handing `reviewSchema` straight to `Output.object` let the AI SDK run its own
 * zod conversion, which re-adds the `minimum`/`maximum`/`minLength` keywords a
 * `strict: true` response format rejects — so the request the gate makes and the
 * request `reviewJsonSchema()` describes were two different requests, and only the
 * eval harness got the sanitized one. Now both send the same schema and zod keeps
 * ownership of validation through `validate`.
 */
const reviewOutput = jsonSchema<Review>(() => reviewJsonSchema() as ReturnType<typeof reviewJsonSchema> & object, {
  validate: (value) => {
    const parsed = reviewSchema.safeParse(value);
    return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error };
  },
});

export { createProvider, createModel, type ProviderBundle } from "./openrouter.ts";

export { readRelatedContracts, readReviewCriteria, reviewTools, findRelatedContracts } from "./tools.ts";

export {
  CRITERIA,
  CRITERION_SLUGS,
  SEVERITIES,
  VERDICTS,
  findingSchema,
  reviewSchema,
  reviewJsonSchema,
  scoresSchema,
  REVIEW_INSTRUCTIONS,
  type Criterion,
  type CriterionKey,
  type CriterionSlug,
  type Finding,
  type Review,
  type Scores,
  type Severity,
  type Verdict,
} from "./criteria.ts";

export interface ReviewInput {
  /** Source file contents or a unified diff. */
  code: string;
  /** Path shown to the model, used to fill in `finding.file`. */
  path?: string;
  /** Anything worth knowing: conventions, related modules, the ticket. */
  context?: string;
}

export interface StepLog {
  /** 1-based, so the log reads the way a person counts. */
  step: number;
  finishReason: string;
  toolCalls: string[];
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  /** Running total across every step so far. */
  cumulativeTokens: number;
}

export interface ReviewOptions {
  /** Defaults to the model from `OPENROUTER_MODEL`. */
  model?: LanguageModel;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  /**
   * Hard ceiling on model calls in the tool loop, kept deliberately.
   * A reviewer that cannot finish in this many steps is looping, not thinking, and
   * an unbounded loop bills the API key until something else stops it.
   */
  maxSteps?: number;
  /** Defaults to one compact line per step on stderr; stdout stays the report. */
  onStep?: (log: StepLog) => void;
  /**
   * Off turns the review back into a single blind pass over the diff. Exists so the
   * tools can be measured against their own absence on identical fixtures, which is
   * the only way to tell a tool win from a prompt win.
   */
  useTools?: boolean;
}

/** One step's worth of progress, on stderr so `--json` output stays parseable. */
function logStep(log: StepLog): void {
  const tools = log.toolCalls.length === 0 ? "—" : log.toolCalls.join(",");
  stderr.write(
    `[reviewer] step ${String(log.step)} finish=${log.finishReason} tools=${tools} ` +
      `in=${String(log.inputTokens ?? "?")} out=${String(log.outputTokens ?? "?")} cumulative=${String(log.cumulativeTokens)}\n`,
  );
}

/** Steps a review is allowed: look something up, look one more thing up, answer. */
const DEFAULT_MAX_STEPS = 6;

export interface ReviewResult {
  review: Review;
  usage: LanguageModelUsage;
  /** Model calls made, including tool-call steps. */
  steps: number;
  /** What OpenRouter charged for the whole loop, when it reported it. */
  cost: number | undefined;
}

function buildPrompt({ code, path, context }: ReviewInput): string {
  const parts = [`Review the following code${path ? ` from \`${path}\`` : ""}.`];

  if (context) {
    parts.push(`Context:\n${context}`);
  }

  parts.push(`Code:\n\`\`\`\n${code}\n\`\`\``);

  return parts.join("\n\n");
}

/** Runs one structured review pass and returns schema-validated findings. */
export async function reviewCode(input: ReviewInput, options: ReviewOptions = {}): Promise<ReviewResult> {
  if (input.code.trim() === "") {
    throw new Error("Nothing to review: `code` is empty.");
  }

  const model = options.model ?? createProvider().model;
  const onStep = options.onStep ?? logStep;

  let step = 0;
  let cumulativeTokens = 0;

  const useTools = options.useTools ?? true;

  const { output, usage, steps } = await generateText({
    model,
    instructions: REVIEW_INSTRUCTIONS,
    prompt: buildPrompt(input),
    ...(useTools ? { tools: reviewTools } : {}),
    stopWhen: stepCountIs(options.maxSteps ?? DEFAULT_MAX_STEPS),
    output: Output.object({ schema: reviewOutput }),
    temperature: options.temperature ?? 0.2,
    // `onStepFinish` is the deprecated alias for this in ai@7; same callback.
    onStepEnd: ({ finishReason, toolCalls, usage: stepUsage }) => {
      step += 1;
      cumulativeTokens += stepUsage.totalTokens ?? 0;
      onStep({
        step,
        finishReason,
        toolCalls: toolCalls.map((call) => call.toolName),
        inputTokens: stepUsage.inputTokens,
        outputTokens: stepUsage.outputTokens,
        cumulativeTokens,
      });
    },
    ...(options.maxOutputTokens === undefined ? {} : { maxOutputTokens: options.maxOutputTokens }),
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
  });

  // OpenRouter bills each step separately, so the loop's cost is their sum.
  const cost = steps.reduce<number | undefined>((total, one) => {
    const stepCost = (one.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost;
    return stepCost === undefined ? total : (total ?? 0) + stepCost;
  }, undefined);

  return { review: output, usage, steps: steps.length, cost };
}
