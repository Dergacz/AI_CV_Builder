import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Mirrors the `@/*` -> `./src/*` path alias from tsconfig so unit tests resolve imports the same way.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
