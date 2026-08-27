import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import { tool } from "ai";
import { z } from "zod";

import { CRITERIA, CRITERION_SLUGS } from "./criteria.generated.ts";

/**
 * Read-only tools for the reviewer.
 *
 * Both are pure reads. Nothing here writes, deletes, spawns a process, or takes a
 * network call — a review must not be able to change the thing it is reviewing.
 *
 * Path safety is structural rather than checked: `readRelatedContracts` never opens
 * a path the model supplies. Model input is used only as *search keys* against a
 * catalogue this module builds itself from a fixed list of directories under the
 * repository root, so there is no filename for a `../../etc/passwd` to travel
 * through. `assertInsideRepo` is a second belt on the catalogue itself.
 */

/** The repository root: this file lives at <root>/packages/code-reviewer/src/. */
const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");

/**
 * Where contracts live in this repository. Every one of these is a place two
 * descriptions of the same shape can drift apart — the failure criterion 1 is about.
 * Directories are scanned one level deep; single files are taken as they are.
 */
const CONTRACT_SURFACES = [
  { dir: "src/lib", extensions: [".ts"] },
  { dir: "src/lib/services", extensions: [".ts"] },
  { dir: "supabase/migrations", extensions: [".sql"] },
  { dir: "supabase/tests/database", extensions: [".sql"] },
  { file: "src/types.ts" },
  { file: "src/db/database.types.ts" },
] as const;

/**
 * Pulled in whenever the diff touches one end of it, regardless of keywords.
 *
 * The generated-draft shape is written down in two places that no naming convention
 * connects: a zod schema in `cv-draft.ts` and a hand-maintained JSON Schema for
 * OpenAI strict mode in `cv-generation.ts`. A diff that moves one and not the other
 * compiles and passes its tests, so the pair travels together or the drift is
 * invisible.
 */
const CONTRACT_CHAINS: { when: RegExp; pull: string[] }[] = [
  {
    when: /cv-(generation|draft|draft-validation|draft-messages)\.ts$/,
    pull: ["src/lib/cv-draft.ts", "src/lib/services/cv-generation.ts"],
  },
];

/** Structural path fragments that name a layer, not a contract. */
const NOISE = new Set([
  "src",
  "lib",
  "app",
  "pages",
  "api",
  "components",
  "services",
  "hooks",
  "utils",
  "index",
  "test",
  "tests",
  "spec",
  "new",
  "create",
  "add",
  "update",
  "schema",
  "types",
  "ts",
  "tsx",
  "sql",
  "astro",
]);

/**
 * A keyword on more than this share of the contract surface identifies nothing.
 * `cv` is on almost every file in this project — matching on it returns the whole
 * directory and buries the one file that mattered. Measured rather than blocklisted
 * so the tool keeps working when the project's prefixes change.
 */
const COMMON_KEYWORD_SHARE = 0.25;

/** Below this, a match is too weak to be worth the tokens. */
const MIN_SCORE = 4;

const MAX_FILES = 8;
const MAX_FILE_BYTES = 16_000;
const MAX_TOTAL_BYTES = 48_000;

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertInsideRepo(absolute: string): void {
  if (absolute !== REPO_ROOT && !absolute.startsWith(REPO_ROOT + sep)) {
    throw new Error(`Refusing to read outside the repository: ${absolute}`);
  }
}

/** `20260724194333_create_feedback.sql` → ["feedback"]; `cv-tags-repository.ts` → ["cv", "tags", "repository"]. */
function keywordsFrom(text: string): string[] {
  return basename(text)
    .replace(/^\d{8,}[_-]?/, "")
    .split(/[^a-z0-9]+/i)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length >= 2 && !NOISE.has(part) && !/^\d+$/.test(part));
}

interface Candidate {
  path: string;
  score: number;
  why: string[];
}

async function listSurface(): Promise<string[]> {
  const found: string[] = [];

  for (const surface of CONTRACT_SURFACES) {
    if ("file" in surface) {
      const absolute = join(REPO_ROOT, surface.file);
      assertInsideRepo(absolute);
      if (await stat(absolute).then(() => true, () => false)) found.push(surface.file);
      continue;
    }

    const absolute = join(REPO_ROOT, surface.dir);
    assertInsideRepo(absolute);
    const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (/\.(test|spec)\.[cm]?tsx?$/.test(entry.name)) continue;
      if (!surface.extensions.some((extension) => entry.name.endsWith(extension))) continue;
      found.push(`${surface.dir}/${entry.name}`);
    }
  }

  return [...new Set(found)];
}

async function readCapped(relativePath: string): Promise<string> {
  const absolute = join(REPO_ROOT, relativePath);
  assertInsideRepo(absolute);
  const content = await readFile(absolute, "utf8");

  if (content.length <= MAX_FILE_BYTES) return content;

  return `${content.slice(0, MAX_FILE_BYTES)}\n… [truncated at ${String(MAX_FILE_BYTES)} characters]`;
}

/**
 * Ranks the contract surface against the diff's paths and identifiers.
 * Exported for tests; the tool below is a thin wrapper over it.
 */
export async function findRelatedContracts(
  paths: string[],
  identifiers: string[],
): Promise<{ path: string; why: string[]; content: string }[]> {
  const surface = await listSurface();
  const surfaceKeywords = new Map(surface.map((path) => [path, keywordsFrom(path)]));

  // How many files each keyword appears on, so a project-wide prefix scores near zero.
  const documentFrequency = new Map<string, number>();
  for (const keywords of surfaceKeywords.values()) {
    for (const keyword of new Set(keywords)) {
      documentFrequency.set(keyword, (documentFrequency.get(keyword) ?? 0) + 1);
    }
  }
  const isCommon = (keyword: string): boolean =>
    (documentFrequency.get(keyword) ?? 0) > surface.length * COMMON_KEYWORD_SHARE;

  const touched = new Set(paths.map((path) => path.replace(/^\/+/, "")));
  const keywords = [...new Set(paths.flatMap(keywordsFrom))];
  // Short identifiers ("id", "ok", "body") match everywhere and prove nothing.
  const needles = identifiers.map((identifier) => identifier.trim()).filter((needle) => needle.length >= 4);

  const chained = new Set(
    CONTRACT_CHAINS.filter((chain) => paths.some((path) => chain.when.test(path))).flatMap((chain) => chain.pull),
  );

  const candidates: Candidate[] = [];

  for (const path of surface) {
    // A file the diff already shows is not "related context" — the model has it.
    if (touched.has(path)) continue;

    const why: string[] = [];
    let score = 0;

    if (chained.has(path)) {
      score += 10;
      why.push("the other end of the generated-draft contract");
    }

    const pathKeywords = surfaceKeywords.get(path) ?? [];
    const shared = keywords.filter((keyword) => pathKeywords.includes(keyword));
    const distinctive = shared.filter((keyword) => !isCommon(keyword));

    if (distinctive.length > 0) {
      score += 4 * distinctive.length;
      why.push(`path matches ${distinctive.join(", ")}`);
    } else if (shared.length > 1) {
      // Several weak keywords together still say something; one on its own does not.
      score += 2;
      why.push(`path matches ${shared.join(", ")}`);
    }

    if (needles.length > 0) {
      const content = await readFile(join(REPO_ROOT, path), "utf8").catch(() => "");
      const hit = needles.find((needle) => new RegExp(`\\b${escapeRegExp(needle)}\\b`).test(content));
      if (hit !== undefined) {
        score += 5;
        why.push(`defines or mentions \`${hit}\``);
      }
    }

    if (score >= MIN_SCORE) candidates.push({ path, score, why });
  }

  candidates.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const selected: { path: string; why: string[]; content: string }[] = [];
  let budget = MAX_TOTAL_BYTES;

  for (const candidate of candidates.slice(0, MAX_FILES)) {
    const content = await readCapped(candidate.path);
    if (content.length > budget) break;
    budget -= content.length;
    selected.push({ path: candidate.path, why: candidate.why, content });
  }

  return selected;
}

export const readRelatedContracts = tool({
  description: [
    "Read the OTHER SIDE of a contract the diff only shows one side of.",
    "",
    "Call this before judging contract synchrony on any diff that changes a zod schema, a TypeScript type, an enum member, a length or range limit, a JSON Schema for the model, a SQL column, a check constraint, or an RLS policy — and call it before concluding that such a change is complete. The counterpart usually lives in a file the diff does not include: a zod schema has a JSON Schema twin, a migration has a generated-types twin, a limit in code has a check-constraint twin.",
    "",
    "Also call it when the diff ADDS an enum member, a warning code, an error bucket or a status value, to check whether every place that lists those values learned about the new one.",
    "",
    "Do not call it for a change that touches no shape — a pure refactor, copy edits, comments, formatting. Do not call it twice with the same arguments.",
    "",
    "Returns whole files from this repository, most relevant first. Reads only; it cannot modify anything.",
  ].join("\n"),
  inputSchema: z.object({
    paths: z
      .array(z.string())
      .min(1)
      .describe(
        "Every file path the diff touches, exactly as written in the diff headers. These are used as search keys, not opened directly, so a path that does not exist yet (a new file) is still useful.",
      ),
    identifiers: z
      .array(z.string())
      .default([])
      .describe(
        'Names whose definition you want to see: a schema, type, constant, column, enum member or error code, e.g. "generatedCvDraftSchema", "date_gaps", "comment". Optional but sharpens the result.',
      ),
  }),
  execute: async ({ paths, identifiers }) => {
    const related = await findRelatedContracts(paths, identifiers);

    if (related.length === 0) {
      return {
        found: 0,
        note: "No related contract file matched. Judge the diff on what it shows; do not assume a counterpart exists.",
        files: [],
      };
    }

    return {
      found: related.length,
      files: related.map((file) => ({ path: file.path, why: file.why.join("; "), content: file.content })),
    };
  },
});

export const readReviewCriteria = tool({
  description: [
    "Read the full rubric for one of the five review criteria, or all five.",
    "",
    "Call this when you are unsure which score a specific defect deserves, or whether something you are looking at counts as a violation at all — the rubric describes what a 1 and a 10 look like in concrete terms for this project, with named files and named failure modes.",
    "",
    "You do not need it to review a diff that is plainly fine, and you do not need it twice for the same criterion.",
    "",
    "Served from the criteria document; reads only.",
  ].join("\n"),
  inputSchema: z.object({
    criterion: z
      .enum(CRITERION_SLUGS)
      .optional()
      .describe("Which criterion's rubric to read. Omit to get all five."),
  }),
  execute: ({ criterion }) => {
    const wanted = criterion === undefined ? CRITERIA : CRITERIA.filter((c) => c.slug === criterion);

    return {
      criteria: wanted.map((c) => ({
        number: c.number,
        slug: c.slug,
        name: c.name,
        title: c.title,
        scoreOf1: c.rubric.one,
        scoreOf10: c.rubric.ten,
      })),
    };
  },
});

/** The reviewer's full tool set. Read-only by construction. */
export const reviewTools = { readRelatedContracts, readReviewCriteria };

export { REPO_ROOT, relative as relativeToRepo };
