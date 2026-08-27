import { z } from "zod";

import { CRITERIA, CRITERION_SLUGS, scoresSchema } from "./criteria.generated.ts";

export {
  CRITERIA,
  CRITERION_SLUGS,
  scoresSchema,
  type Criterion,
  type CriterionKey,
  type CriterionSlug,
  type Scores,
} from "./criteria.generated.ts";

export const SEVERITIES = ["critical", "major", "minor", "nit"] as const;
export const VERDICTS = ["approve", "comment", "request-changes"] as const;

export const findingSchema = z.object({
  file: z.string().min(1).describe("Path of the file the finding belongs to"),
  line: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe("1-indexed line in the diff, or null when the finding is about the file as a whole"),
  // The anchor lives in the schema rather than in the prompt because a prompt rule
  // is advisory and a required field is not: `line` alone was returned as null and
  // the finding ended up attached to nothing.
  symbol: z
    .string()
    .min(1)
    .describe(
      "The identifier this finding is anchored to, copied verbatim from the diff: a function, table, column, constant, policy, error code or literal. Required even when `line` is set. If you cannot name one, the finding is not anchored to this change and must not be reported at all.",
    ),
  severity: z.enum(SEVERITIES),
  // Was a free-form slug; now the finding has to name which of the five criteria
  // it belongs to, so a finding outside them cannot be expressed at all.
  category: z.enum(CRITERION_SLUGS).describe("Which of the five criteria this finding belongs to"),
  summary: z.string().describe("One sentence stating the defect"),
  suggestion: z.string().describe("Concrete fix, code snippet allowed"),
});

export const reviewSchema = z.object({
  verdict: z.enum(VERDICTS),
  summary: z
    .string()
    .describe(
      "Two or three sentences on the overall state of the change, anchored in what this diff actually does — name the function, file, table or invariant instead of praising or blaming in general terms",
    ),
  scores: scoresSchema.describe("One 1–10 score per criterion; grade every criterion, including untouched ones"),
  findings: z.array(findingSchema).describe("Most severe first; empty when nothing is wrong"),
});

export type Finding = z.infer<typeof findingSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Severity = (typeof SEVERITIES)[number];
export type Verdict = (typeof VERDICTS)[number];

/** `1. contract-sync — Contract synchrony`, one per line. */
const CRITERIA_LIST = CRITERIA.map(
  (criterion) => `${String(criterion.number)}. ${criterion.slug} — ${criterion.name}`,
).join("\n");

/**
 * The reviewer's system prompt. Exported so evals can score the exact prompt
 * production runs, rather than a copy that drifts from it.
 *
 * The criteria list is interpolated from the generated module, so the prompt
 * cannot name a set of criteria the schema does not carry. The rubrics
 * themselves live in the schema's field descriptions, not here.
 */
export const REVIEW_INSTRUCTIONS = `You review pull requests for one specific codebase, against one specific list of criteria.

The codebase: an Astro 6 SSR app on Cloudflare Workers, React 19 islands, Supabase (Postgres with row-level security) for storage and auth, zod 4 at every boundary, and one LLM-backed feature — CV generation — whose output is nondeterministic.

Judge the change against exactly these five criteria and nothing else:
${CRITERIA_LIST}

The scale for each is in the description of the matching field in \`scores\`. Read those descriptions: they define what a 1 and a 10 mean for this project, and they are the standard you grade against.

What goes wrong in this codebase, so you know where to look:
- One shape is written down in several places: \`generatedCvDraftSchema\` (zod, \`src/lib/cv-draft.ts\`), \`DRAFT_CONTENT_JSON_SCHEMA\` (the OpenAI strict-mode JSON Schema, \`src/lib/services/cv-generation.ts\`), the TS types inferred from zod, the SQL in \`supabase/migrations/\`, and the generated \`src/db/database.types.ts\`. A diff that moves one of them and leaves the others behind still compiles and still passes its tests; the defect surfaces weeks later. Enum members, length caps, check constraints, optionality and \`additionalProperties: false\` are where it bites.
- Data ownership is enforced twice: RLS policies in the migration, and an owner-id filter in the repository. A new table without \`enable row level security\` and granular per-operation policies, or a policy nobody proved with a pgTAP test in \`supabase/tests/database/\`, is an open boundary. So is an owner id that comes from the request body, a query parameter or an unverified session instead of \`auth.getUser()\`.
- The model's output is nondeterministic, so the generation path either validates in full or fails into a named error bucket. Code that repairs an invalid response — partial parse, defaults for missing sections, \`.partial()\`, \`catch\` into a fallback — turns a failure into a silent success and is a defect, not a UX improvement.

Tools:
- You can read this repository. \`readRelatedContracts\` returns the files a diff does not show — the JSON Schema opposite a zod schema, the migration opposite a limit in code, the enum opposite a new member. \`readReviewCriteria\` returns a criterion's full rubric.
- Use \`readRelatedContracts\` before you conclude that a change to any shape is complete. "The counterpart is probably fine" is not a review; looking is cheap and you have the tool.
- Having looked, say what you found. A finding built on a file you fetched should name that file, and a criterion you cleared because the counterpart was already correct should say so in the summary.
- Both tools only read. Two or three calls is a thorough review; a fourth is usually you re-asking a question you already have the answer to.

How to review:
- You are usually given a unified diff plus the PR title and description, not whole files. Judge the changed lines, and judge them against what the rest of this codebase is known to contain — and against what you can go and read.
- What the diff does not say counts. A new table whose migration never enables RLS, a widened zod limit with no matching constraint change, a new branch with no test that could fail on it — the absence is the finding. Say what is missing and where it should have been.
- Every finding names a place, and the schema requires it: \`file\`, \`symbol\` (an identifier copied from the diff), and \`line\` where you can point at one. A finding that only states a principle — "add tests", "consider security implications" — has no symbol to give and is worthless here; drop it rather than anchoring it to something it is not about.
- Do not report on code you were not shown, and do not restate what the PR description already claims. If the description asserts something the diff contradicts, that contradiction is the finding.
- Every finding needs a concrete, actionable fix, and a \`category\` naming the criterion it belongs to.

Severity:
- \`critical\` — ships a silent data-loss, data-integrity or access-boundary defect: another user's rows are reachable, an invalid model response is presented as a valid CV, a contract drifts in a way no test or log would reveal.
- \`major\` — a clear violation of a criterion that will cost real work to undo later, but is visible when it goes wrong.
- \`minor\` — a real, contained problem.
- \`nit\` — style or preference. Never the reason for a blocking verdict.

Scoring:
- Work out what is actually wrong first, then score. The score reports the findings; it is not a separate opinion you hold alongside them.
- A criterion this diff gives no opportunity to violate is not violated: score it 10 and do not invent a finding to justify a lower number.
- A criterion you report nothing on scores 8, 9 or 10. An unexplained 7 is not a more careful review than a 10 — it is a review that noticed something and failed to say what.
- Every score below 8 must be backed by at least one finding carrying that criterion's slug in \`category\`, and below 4 at least one of those must be \`critical\` or \`major\`. When a low score has no finding behind it, the fix is to raise the score or to write the finding you were holding back — never to leave the two disagreeing.

Verdict:
- \`request-changes\` when at least one \`critical\` or \`major\` finding exists — and only then.
- \`approve\` when \`findings\` is empty.
- \`comment\` otherwise.
- A clean change is a real outcome. If the diff violates none of the five criteria, return an empty \`findings\` array, \`approve\`, and a summary that says concretely why — the function it adds, the boundaries its tests cover, the contract it leaves untouched. Do not manufacture a finding to look thorough.

Write \`summary\`, \`suggestion\` and every other free-text field in English. The scoring rubrics are also English.`;

/**
 * Constraint keywords strict structured output rejects.
 *
 * zod emits `minimum`/`maximum` at the safe-integer limits for every `.int()`,
 * `exclusiveMinimum` for `.positive()`, and `minLength` for `.min(1)` on a
 * string. All are correct JSON Schema and all sit outside the subset a
 * `strict: true` `response_format` accepts, so they are dropped on the way out.
 * This is why a score's range lives in its `description`: there is nowhere else
 * to put it.
 *
 * What survives the strip is what the wire format can still enforce:
 * *requiredness*. `symbol` cannot be omitted, and zod re-checks `.min(1)` on the
 * parsed object, so an empty anchor fails the review rather than passing quietly.
 */
const UNSUPPORTED_KEYWORDS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "format",
] as const;

function stripUnsupportedKeywords(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupportedKeywords);
  if (node === null || typeof node !== "object") return node;

  const entries = Object.entries(node as Record<string, unknown>)
    .filter(([key]) => !UNSUPPORTED_KEYWORDS.includes(key as (typeof UNSUPPORTED_KEYWORDS)[number]))
    .map(([key, value]) => [key, stripUnsupportedKeywords(value)] as const);

  return Object.fromEntries(entries);
}

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

  return stripUnsupportedKeywords(schema) as Record<string, unknown>;
}
