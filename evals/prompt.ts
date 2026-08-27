import { REVIEW_INSTRUCTIONS } from "../packages/code-reviewer/src/criteria.ts";

/** Everything from this line on is the fixture's answer key — see fixtures/README.md. */
const METADATA_MARKER = /^--- FIXTURE METADATA.*$/m;

/** Cuts the answer key off a fixture so it can never reach the model under test. */
export function stripFixtureMetadata(raw: string): string {
  const match = METADATA_MARKER.exec(raw);
  const body = (match === null ? raw : raw.slice(0, match.index)).trim();

  if (body === "") {
    throw new Error("Fixture is empty once its metadata block is stripped.");
  }

  return body;
}

export function reviewPrompt({ vars }: { vars: { diff: string } }) {
  return [
    // Verbatim, exactly as the CLI passes it as `instructions`. The output
    // schema travels via `response_format`, the way the AI SDK sends it.
    { role: "system", content: REVIEW_INSTRUCTIONS },
    {
      role: "user",
      content: `Review the following pull request.\n\n${stripFixtureMetadata(vars.diff)}`,
    },
  ];
}
