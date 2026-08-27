import { generateText, Output, jsonSchema, type LanguageModel, type LanguageModelUsage } from "ai";

import { REVIEW_INSTRUCTIONS, reviewJsonSchema, reviewSchema, type Review } from "./criteria.ts";
import { createProvider } from "./openrouter.ts";

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
    output: Output.object({ schema: reviewOutput }),
    temperature: options.temperature ?? 0.2,
    ...(options.maxOutputTokens === undefined ? {} : { maxOutputTokens: options.maxOutputTokens }),
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
  });

  return { review: output, usage };
}
