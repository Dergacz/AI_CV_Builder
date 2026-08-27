import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { argv, exit, stderr, stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

import { CRITERIA, reviewCode, type Finding, type Review } from "./review.ts";

export { loadEnv, envSchema, type Env } from "./env.ts";
export { createProvider, type ProviderBundle } from "./openrouter.ts";
export {
  reviewCode,
  reviewSchema,
  reviewJsonSchema,
  findingSchema,
  scoresSchema,
  REVIEW_INSTRUCTIONS,
  CRITERIA,
  CRITERION_SLUGS,
  SEVERITIES,
  VERDICTS,
  type Criterion,
  type CriterionKey,
  type CriterionSlug,
  type Finding,
  type Review,
  type Scores,
  type ReviewInput,
  type ReviewOptions,
  type ReviewResult,
  type Severity,
  type Verdict,
} from "./review.ts";

const SEVERITY_ICON: Record<Finding["severity"], string> = {
  critical: "🛑",
  major: "⚠️ ",
  minor: "🔸",
  nit: "·",
};

/** Renders a review as plain text for a terminal. */
export function formatReview(review: Review): string {
  const scores = CRITERIA.map((criterion) => `${criterion.slug} ${String(review.scores[criterion.key])}/10`).join("  ");

  const lines = [`verdict: ${review.verdict}`, `scores:  ${scores}`, "", review.summary, ""];

  if (review.findings.length === 0) {
    lines.push("No findings.");
    return lines.join("\n");
  }

  for (const finding of review.findings) {
    const at = finding.line === null ? finding.file : `${finding.file}:${finding.line}`;
    const location = `${at} · ${finding.symbol}`;
    lines.push(
      `${SEVERITY_ICON[finding.severity]} [${finding.severity}/${finding.category}] ${location}`,
      `   ${finding.summary}`,
      `   → ${finding.suggestion}`,
      "",
    );
  }

  return lines.join("\n");
}

async function readStdin(): Promise<string> {
  if (stdin.isTTY) return "";

  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

const USAGE = `Usage:
  npm start -- <file> [--json] [--context-file <path>] [--max-output-tokens <n>]
  git diff | npm start -- --json [--context-file <path>]

Env: OPENROUTER_API_KEY (required), OPENROUTER_MODEL, OPENROUTER_APP_NAME, OPENROUTER_APP_URL`;

/**
 * Pulls `--name <value>` (or `--name=<value>`) out of `args`, mutating it so the
 * value is not later mistaken for the file to review.
 */
function takeOption(args: string[], name: string): string | undefined {
  const flag = `--${name}`;
  const index = args.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (index === -1) return undefined;

  const arg = args[index];
  if (arg === undefined) return undefined;

  const inline = arg.length > flag.length ? arg.slice(flag.length + 1) : undefined;
  const value = inline ?? args[index + 1];

  if (value === undefined || value === "" || value.startsWith("-")) {
    throw new Error(`${flag} requires a path.`);
  }

  args.splice(index, inline === undefined ? 2 : 1);
  return value;
}

async function main(): Promise<void> {
  // Load .env when present; env vars already set take precedence.
  if (existsSync(".env")) process.loadEnvFile(".env");

  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    stdout.write(`${USAGE}\n`);
    return;
  }

  const contextPath = takeOption(args, "context-file");
  const maxTokensRaw = takeOption(args, "max-output-tokens");
  const asJson = args.includes("--json");
  const files = args.filter((arg) => !arg.startsWith("-"));

  const path = files[0];
  const code = path === undefined ? await readStdin() : await readFile(path, "utf8");

  if (code.trim() === "") {
    stderr.write(`Nothing to review — pass a file or pipe a diff on stdin.\n\n${USAGE}\n`);
    exit(1);
  }

  // Read from a file rather than an argv string: PR descriptions are multi-line and
  // routinely contain quotes, backticks and newlines.
  const context = contextPath === undefined ? "" : await readFile(contextPath, "utf8");

  // Left unset, providers reserve the model's full output ceiling against the API
  // key's balance, which fails outright on a key with limited remaining credit.
  let maxOutputTokens: number | undefined;
  if (maxTokensRaw !== undefined) {
    maxOutputTokens = Number.parseInt(maxTokensRaw, 10);
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0) {
      throw new Error("--max-output-tokens must be a positive integer.");
    }
  }

  const { review, usage } = await reviewCode(
    {
      code,
      ...(path ? { path } : {}),
      ...(context.trim() ? { context } : {}),
    },
    maxOutputTokens === undefined ? {} : { maxOutputTokens },
  );

  if (asJson) {
    stdout.write(`${JSON.stringify(review, null, 2)}\n`);
  } else {
    stdout.write(`${formatReview(review)}\n`);
    stderr.write(`tokens: in=${usage.inputTokens ?? "?"} out=${usage.outputTokens ?? "?"}\n`);
  }
}

const isEntrypoint = argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1];

if (isEntrypoint) {
  main().catch((error: unknown) => {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    exit(1);
  });
}
