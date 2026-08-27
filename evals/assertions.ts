import type { Finding, Review } from "../packages/code-reviewer/src/criteria.ts";

interface GradingResult {
  pass: boolean;
  score: number;
  reason: string;
}

function parseReview(output: string): Review {
  return JSON.parse(output) as Review;
}

/** Everything a finding says, flattened, for matching against one regex. */
function text(finding: Finding): string {
  return `${finding.file} ${finding.symbol} ${finding.category} ${finding.summary} ${finding.suggestion}`;
}

function isSevere(finding: Finding): boolean {
  return finding.severity === "critical" || finding.severity === "major";
}

function verdictOf(review: Review): string {
  return review.verdict;
}

/** Renders findings compactly so a failure says what the model *did* report. */
function digest(review: Review): string {
  if (review.findings.length === 0) return "no findings";

  return review.findings.map((f) => `${f.severity}/${f.category} @ ${f.file}: ${f.summary}`).join(" | ");
}

function result(pass: boolean, reason: string): GradingResult {
  return { pass, score: pass ? 1 : 0, reason };
}

/**
 * Wraps a fixture's condition so a non-JSON response fails as a bad response
 * rather than as a crash inside the assertion.
 */
function condition(check: (review: Review) => GradingResult) {
  return (output: string): GradingResult => {
    let review: Review;

    try {
      review = parseReview(output);
    } catch {
      return result(false, "Output is not JSON, so the fixture condition cannot be evaluated.");
    }

    return check(review);
  };
}

/**
 * 01 — the doc comment promises the cap keeps the name "well inside the 255-byte
 * filename limit", but `truncateStem` cuts by characters: 80 CJK characters run to
 * ~320 bytes. The code is a legitimate choice; the guarantee written next to it is
 * not. Two-sided on purpose — the catch has to happen AND stay proportionate, since
 * an inaccurate comment is not a reason to block a PR.
 */
export const byteClaimDrift = condition((review) => {
  const hit = review.findings.find(
    (f) => /cv-export-filename/i.test(f.file) && /byte|255|character|char|multi-?byte|utf-?8/i.test(text(f)),
  );

  if (hit === undefined) {
    return result(false, `No finding tying the 255-byte claim to character-based truncation — ${digest(review)}`);
  }

  if (verdictOf(review) === "request-changes") {
    return result(
      false,
      `Caught the byte/character drift but blocked on it, which is disproportionate: ${hit.summary}`,
    );
  }

  return result(true, `Caught the byte/character drift: ${hit.summary}`);
});

/**
 * 07 — the genuinely clean PR, and the mirror image of 03: RLS on, granular
 * per-operation policies, a pgTAP test that proves a stranger gets zero rows, an
 * owner id from `safeGetUser()`. Any finding here is the agent speculating about
 * code it was not shown.
 */
export const cleanPr = condition((review) => {
  const pass = review.findings.length === 0 && verdictOf(review) === "approve";

  return result(
    pass,
    pass
      ? "Approved with no findings."
      : `Expected approve + zero findings, got ${verdictOf(review)} — ${digest(review)}`,
  );
});

/**
 * 02 — zod raised the comment cap to 2000, the check constraint in the existing
 * migration still says 1000. The catch has to name the database side, not just
 * observe that the zod limit moved.
 */
export const zodMigrationDrift = condition((review) => {
  const hit = review.findings.find(
    (f) =>
      isSevere(f) &&
      /feedback|comment/i.test(f.file) &&
      /migration|constraint|check|database|\bdb\b|1000|postgres/i.test(text(f)),
  );

  return result(
    hit !== undefined,
    hit
      ? `Caught the zod/constraint drift: ${hit.summary}`
      : `No severe finding tying the zod cap to the DB constraint — ${digest(review)}`,
  );
});

/**
 * 03 — new table with no RLS and no policies. This is the access-boundary
 * criterion, so it has to land as a blocking finding, not a note.
 */
export const missingRls = condition((review) => {
  const hit = review.findings.find(
    (f) =>
      isSevere(f) &&
      /cv[_-]?tags/i.test(f.file) &&
      /rls|row level security|polic|access|tenant|authoriz/i.test(text(f)),
  );

  const pass = hit !== undefined && verdictOf(review) === "request-changes";

  return result(
    pass,
    pass
      ? `Blocked on missing RLS: ${hit.summary}`
      : `Expected request-changes plus a severe RLS finding on the cv_tags migration, got ${verdictOf(review)} — ${digest(review)}`,
  );
});

/**
 * 04 — the test asserts its own mock. The catch has to be about the assertions
 * being unfalsifiable, not merely about coverage being thin.
 */
export const vacuousTest = condition((review) => {
  const hit = review.findings.find(
    (f) =>
      isSevere(f) &&
      /cv-generate-envelope|test/i.test(f.file) &&
      /mock|tautolog|vacuous|always pass|asserts? (its|the) own|toBeDefined|meaningless|would (still )?pass/i.test(
        text(f),
      ),
  );

  return result(
    hit !== undefined,
    hit
      ? `Caught the vacuous assertions: ${hit.summary}`
      : `No severe finding about the test asserting its own mock — ${digest(review)}`,
  );
});

/**
 * 05 — the prompt emits `date_gaps`, the zod warning-code enum does not know it.
 * Naming the code (or the enum it is missing from) is the whole catch.
 */
export const warningCodeDrift = condition((review) => {
  const hit = review.findings.find(
    (f) => isSevere(f) && /date_gaps|draftWarningCode|cv-draft|warning code/i.test(text(f)),
  );

  return result(
    hit !== undefined,
    hit
      ? `Caught the warning-code drift: ${hit.summary}`
      : `No severe finding naming date_gaps or the warning-code enum — ${digest(review)}`,
  );
});

/**
 * 06 — an invalid model response is repaired into `ok: true` with emptied
 * sections. Honest-failure criterion: this must block, and the catch has to be
 * about the silent salvage rather than about the hardcoded English string.
 */
export const salvagePartialDraft = condition((review) => {
  const hit = review.findings.find(
    (f) =>
      isSevere(f) &&
      /cv-generation/i.test(f.file) &&
      /salvage|partial|silent|empty|repair|fallback|schemaMismatch|masks?|swallow|hides?/i.test(text(f)),
  );

  const pass = hit !== undefined && verdictOf(review) === "request-changes";

  return result(
    pass,
    pass
      ? `Blocked on the silent salvage: ${hit.summary}`
      : `Expected request-changes plus a severe finding on the silent salvage in cv-generation.ts, got ${verdictOf(review)} — ${digest(review)}`,
  );
});
