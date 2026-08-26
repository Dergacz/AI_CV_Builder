import { z } from "zod";

export const SEVERITIES = ["critical", "major", "minor", "nit"] as const;
export const VERDICTS = ["approve", "comment", "request-changes"] as const;

export const findingSchema = z.object({
  file: z.string().describe("Path of the file the finding belongs to"),
  line: z.number().int().positive().nullable().describe("1-indexed line, or null if unknown"),
  severity: z.enum(SEVERITIES),
  category: z.string().describe("Short kebab-case slug, e.g. correctness, security, performance, readability"),
  summary: z.string().describe("One sentence stating the defect"),
  suggestion: z.string().describe("Concrete fix, code snippet allowed"),
});

export const reviewSchema = z.object({
  verdict: z.enum(VERDICTS),
  summary: z.string().describe("Two or three sentences on the overall state of the change"),
  findings: z.array(findingSchema).describe("Most severe first; empty when nothing is wrong"),
});

export type Finding = z.infer<typeof findingSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Severity = (typeof SEVERITIES)[number];
export type Verdict = (typeof VERDICTS)[number];

/**
 * The reviewer's system prompt. Exported so evals can score the exact prompt
 * production runs, rather than a copy that drifts from it.
 */
export const REVIEW_INSTRUCTIONS = `You are a meticulous senior engineer reviewing code.

Rules:
- Report only defects you can point at in the provided code. Never speculate about code you cannot see.
- Prefer correctness, security and data-loss issues over style. Report style only as "nit".
- Every finding needs a concrete, actionable suggestion.
- If the code is fine, return an empty findings array and the "approve" verdict.
- Use "request-changes" only when at least one critical or major finding exists.`;

/**
 * `reviewSchema` as a JSON Schema, for callers that cannot hand zod to the model.
 *
 * Draft-07 because that is what Ajv validates against by default (promptfoo's
 * `is-json` included); `$schema` is dropped for the same reason.
 */
export function reviewJsonSchema(): Record<string, unknown> {
  const { $schema, ...schema } = z.toJSONSchema(reviewSchema, {
    target: "draft-7",
  }) as Record<string, unknown> & { $schema?: string };

  return schema;
}
