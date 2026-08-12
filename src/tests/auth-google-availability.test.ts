import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * R-17: neither auth page may offer a Google button the deployment cannot complete.
 *
 * Asserted statically, on the page source, for the same reason `DeleteAccountPanel.test.ts` asserts
 * statically on the import graph: the property is structural, and the alternatives cannot see it.
 *
 *   - vitest cannot render `.astro` at all — `vitest.config.ts` carries no Astro Vite plugin, so
 *     the files fail import analysis before any assertion runs.
 *   - Even with the Container API wired up, `GoogleSignInButton` is mounted `client:only="react"`,
 *     which renders NOTHING server-side. The button's own copy never appears in SSR output in
 *     either state, so a markup assertion could only ever observe the divider.
 *
 * What this file therefore pins is the guard itself: both pages consult the predicate, and the
 * divider and the button sit inside one conditional rather than two. The failure it exists to catch
 * is someone unwrapping the conditional — or guarding only the button and leaving a separator
 * floating above nothing. Whether the rendered page then looks right is manual verification
 * (plan Phase 2) and, for the configured path, `e2e/oauth-google.spec.ts`.
 */

const PAGES = ["signin", "signup"] as const;

function readPage(name: (typeof PAGES)[number]): string {
  return readFileSync(fileURLToPath(new URL(`../pages/auth/${name}.astro`, import.meta.url)), "utf8");
}

describe.each(PAGES)("auth/%s.astro Google availability guard", (name) => {
  const source = readPage(name);

  it("imports the availability predicate", () => {
    expect(source).toContain('from "@/lib/auth/google-provider"');
    expect(source).toContain("isGoogleAuthConfigured");
  });

  it("resolves availability once, in frontmatter", () => {
    const frontmatter = source.split("---")[1] ?? "";

    expect(frontmatter).toContain("const googleAvailable = isGoogleAuthConfigured();");
  });

  it("renders the Google button only behind the guard", () => {
    // Every occurrence of the island must follow the guard opening, and none may sit outside it.
    expect(source).toContain("googleAvailable && (");
    expect(source.indexOf("googleAvailable && (")).toBeLessThan(source.indexOf("<GoogleSignInButton"));
  });

  it("keeps the divider inside the same guard as the button", () => {
    const guarded = source.slice(source.indexOf("googleAvailable && ("));

    // Both must appear after the guard opens and before it closes, or a deployment without Google
    // shows a separator with nothing beneath it.
    const dividerAt = guarded.indexOf("messages.auth.google.divider");
    const buttonAt = guarded.indexOf("<GoogleSignInButton");
    const guardClosesAt = guarded.indexOf(")\n        }");

    expect(dividerAt).toBeGreaterThan(-1);
    expect(buttonAt).toBeGreaterThan(-1);
    expect(guardClosesAt).toBeGreaterThan(-1);
    expect(dividerAt).toBeLessThan(guardClosesAt);
    expect(buttonAt).toBeLessThan(guardClosesAt);
  });

  it("has exactly one Google button and one divider — no unguarded duplicate", () => {
    expect(source.match(/<GoogleSignInButton/g)).toHaveLength(1);
    expect(source.match(/messages\.auth\.google\.divider/g)).toHaveLength(1);
  });
});
