import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Guard: no test files under `src/pages/`.
 *
 * Astro turns every module in `src/pages/` into a route, so a colocated `*.test.ts`
 * becomes a real endpoint (`/api/cv/index.test`) and drags its dev-only imports —
 * `vitest` included — into the Cloudflare Worker bundle. Tests belong in `src/tests/`
 * (route/API contracts) or next to their module in `src/lib/` (pure helpers).
 */
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

describe("bundle hygiene", () => {
  it("keeps test files out of src/pages so they never become routes", () => {
    const offenders = readdirSync("src/pages", { recursive: true, encoding: "utf-8" }).filter((entry) =>
      TEST_FILE.test(entry),
    );

    expect(offenders, "test files under src/pages/ ship into the production Worker bundle").toEqual([]);
  });
});
