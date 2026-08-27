import { generateText, Output, type LanguageModel, type LanguageModelUsage } from "ai";

import { REVIEW_INSTRUCTIONS, reviewSchema, type Review } from "./criteria.ts";
import { createProvider } from "./openrouter.ts";

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

export interface ReviewOptions {
  /** Defaults to the model from `OPENROUTER_MODEL`. */
  model?: LanguageModel;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

export interface ReviewResult {
  review: Review;
  usage: LanguageModelUsage;
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

  const { output, usage } = await generateText({
    model,
    instructions: REVIEW_INSTRUCTIONS,
    prompt: buildPrompt(input),
    output: Output.object({ schema: reviewSchema }),
    temperature: options.temperature ?? 0.2,
    ...(options.maxOutputTokens === undefined ? {} : { maxOutputTokens: options.maxOutputTokens }),
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
  });

  return { review: output, usage };
}
