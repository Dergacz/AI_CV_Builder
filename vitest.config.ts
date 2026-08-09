import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Mirrors the `@/*` -> `./src/*` path alias from tsconfig so unit tests resolve imports the same way.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `astro:env/server` only exists inside an Astro build; route tests that import a
      // page module need something resolvable behind the specifier.
      "astro:env/server": fileURLToPath(new URL("./src/tests/support/astro-env.stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
