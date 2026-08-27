/**
 * Generates `src/criteria.generated.ts` from `context/review-criteria.md`.
 *
 * The document is the single source of truth for the five criteria; this script
 * is the only thing allowed to copy it into code. Run `--check` in CI to fail on
 * a document that moved without a regenerated file.
 *
 *   node --experimental-strip-types scripts/generate-criteria.ts [--check]
 */
import { readFile, writeFile } from "node:fs/promises";
import { argv, exit, stderr, stdout } from "node:process";
import { join } from "node:path";

const DOC_PATH = join(import.meta.dirname, "..", "..", "..", "context", "review-criteria.md");
const OUT_PATH = join(import.meta.dirname, "..", "src", "criteria.generated.ts");

/** Path as it reads in the repo, for the generated file's header. */
const DOC_LABEL = "context/review-criteria.md";

/**
 * The only hand-maintained part of the pipeline: the document's numbered titles
 * mapped to the identifiers code uses. `title` is asserted against the heading,
 * so renaming a criterion in the document fails the build instead of silently
 * regenerating a field under a name that no longer describes it.
 */
const NAMES = [
  { number: 1, title: "Синхронность контрактов", key: "contractSync", slug: "contract-sync", name: "Contract synchrony" },
  { number: 2, title: "Честный отказ", key: "honestFailure", slug: "honest-failure", name: "Honest failure" },
  { number: 3, title: "Тест, который может упасть", key: "falsifiableTests", slug: "falsifiable-tests", name: "Tests that can fail" },
  { number: 4, title: "Доказанная граница доступа", key: "provenAccessBoundary", slug: "proven-access-boundary", name: "Proven access boundary" },
  { number: 5, title: "Слой, дубли и стоимость чтения", key: "layeringAndReadability", slug: "layering-and-readability", name: "Layering, duplication and cost of reading" },
] as const;

interface ParsedCriterion {
  number: number;
  title: string;
  one: string;
  ten: string;
}

/** Collapses a hard-wrapped paragraph onto one line; blank lines stay breaks. */
function unwrap(block: string): string {
  return block
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim().replace(/\s*\n\s*/g, " "))
    .filter((paragraph) => paragraph !== "")
    .join("\n\n");
}

/**
 * Pulls the paragraphs belonging to one `**<marker>**` block: everything from
 * the marker up to the next bold marker, so a rubric split over two paragraphs
 * is not silently truncated to the first.
 */
function takeBlock(section: string, marker: string): string {
  const paragraphs = section.split(/\n[ \t]*\n/);
  const start = paragraphs.findIndex((p) => p.trimStart().startsWith(`**${marker}**`));

  if (start === -1) {
    throw new Error(`Missing "**${marker}**" block.`);
  }

  const collected = [paragraphs[start]!.trimStart().slice(`**${marker}**`.length)];

  for (const paragraph of paragraphs.slice(start + 1)) {
    if (/^\s*(\*\*|##|---)/.test(paragraph)) break;
    collected.push(paragraph);
  }

  return unwrap(collected.join("\n\n"));
}

function parse(markdown: string): ParsedCriterion[] {
  const headings = [...markdown.matchAll(/^## (\d+)\. (.+)$/gm)];

  if (headings.length === 0) {
    throw new Error(`No "## N. Title" criterion headings found in ${DOC_LABEL}.`);
  }

  return headings.map((heading, index) => {
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1]!.index : markdown.length;
    const section = markdown.slice(start, end);
    const title = heading[2]!.trim();

    try {
      return { number: Number(heading[1]), title, one: takeBlock(section, "Оценка 1."), ten: takeBlock(section, "Оценка 10.") };
    } catch (error) {
      throw new Error(`Criterion "${title}": ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

/**
 * The text the model is scored against. The rubric travels verbatim because
 * structured output rejects `minimum`/`maximum` on an integer — the description
 * is the only place a range and its meaning can be stated.
 */
function describe(entry: (typeof NAMES)[number], parsed: ParsedCriterion): string {
  return [
    `Критерий ${String(parsed.number)}. ${parsed.title} (${entry.name}). Целое число от 1 до 10.`,
    `Оценка 1. ${parsed.one}`,
    `Оценка 10. ${parsed.ten}`,
  ].join("\n\n");
}

function render(parsed: ParsedCriterion[]): string {
  if (parsed.length !== NAMES.length) {
    throw new Error(`${DOC_LABEL} defines ${String(parsed.length)} criteria, this script names ${String(NAMES.length)}.`);
  }

  const pairs = NAMES.map((entry, index) => {
    const match = parsed[index]!;

    if (match.number !== entry.number || match.title !== entry.title) {
      throw new Error(
        `Criterion ${String(index + 1)} in ${DOC_LABEL} reads "${String(match.number)}. ${match.title}", this script expects "${String(entry.number)}. ${entry.title}". Update NAMES in scripts/generate-criteria.ts.`,
      );
    }

    return { entry, parsed: match };
  });

  const criteria = pairs
    .map(({ entry, parsed: p }) =>
      [
        "  {",
        `    number: ${String(p.number)},`,
        `    key: ${JSON.stringify(entry.key)},`,
        `    slug: ${JSON.stringify(entry.slug)},`,
        `    title: ${JSON.stringify(p.title)},`,
        `    name: ${JSON.stringify(entry.name)},`,
        `    rubric: { one: ${JSON.stringify(p.one)}, ten: ${JSON.stringify(p.ten)} },`,
        "  },",
      ].join("\n"),
    )
    .join("\n");

  const fields = pairs
    .map(({ entry, parsed: p }) => `  ${entry.key}: z.number().int().describe(${JSON.stringify(describe(entry, p))}),`)
    .join("\n");

  return `// GENERATED FILE — do not edit by hand.
//
// Source of truth: ${DOC_LABEL}
// Regenerate:      npm run criteria:build  (in packages/code-reviewer)
// Verify in CI:    npm run criteria:check
//
// The rubric text is copied verbatim from the document because structured
// output rejects \`minimum\`/\`maximum\` on an integer: the field description is
// the only lever that tells the model what a 1 and a 10 mean.
import { z } from "zod";

/** The five criteria, in document order. */
export const CRITERIA = [
${criteria}
] as const;

export type Criterion = (typeof CRITERIA)[number];
export type CriterionKey = Criterion["key"];
export type CriterionSlug = Criterion["slug"];

/** Allowed values of \`finding.category\` — a finding always names one criterion. */
export const CRITERION_SLUGS = [
${pairs.map(({ entry }) => `  ${JSON.stringify(entry.slug)},`).join("\n")}
] as const;

/** One 1–10 score per criterion, each carrying its rubric as the description. */
export const scoresSchema = z.object({
${fields}
});

export type Scores = z.infer<typeof scoresSchema>;
`;
}

async function main(): Promise<void> {
  const generated = render(parse(await readFile(DOC_PATH, "utf8")));
  const check = argv.includes("--check");

  if (!check) {
    await writeFile(OUT_PATH, generated, "utf8");
    stdout.write(`Wrote src/criteria.generated.ts from ${DOC_LABEL}.\n`);
    return;
  }

  const current = await readFile(OUT_PATH, "utf8").catch(() => "");

  if (current !== generated) {
    stderr.write(`src/criteria.generated.ts is stale — ${DOC_LABEL} changed. Run: npm run criteria:build\n`);
    exit(1);
  }

  stdout.write(`src/criteria.generated.ts matches ${DOC_LABEL}.\n`);
}

main().catch((error: unknown) => {
  stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  exit(1);
});
