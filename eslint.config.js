/* eslint-disable @typescript-eslint/no-deprecated -- tseslint.config() is the only way to use extends; core defineConfig has incompatible API */
import { includeIgnoreFile } from "@eslint/config-helpers";
import eslint from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import eslintPluginAstro from "eslint-plugin-astro";
import pluginReact from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import path from "node:path";
import tseslint from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

const baseConfig = tseslint.config({
  extends: [eslint.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "no-console": "warn",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  },
});

/**
 * S-08: fence around the Supabase secret (service-role) key.
 *
 * `src/lib/supabase-admin.ts` is the only module that reads `SUPABASE_SECRET_KEY`, which bypasses
 * every RLS policy in the project. Keeping that true is a structural guarantee, not a convention
 * someone remembers — importing it from anywhere but the account-deletion service (which
 * re-exports what routes and pages need) is a lint error. Widening this list is a deliberate act
 * that shows up in review.
 */
const secretKeyFenceConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx,astro}"],
  ignores: [
    "src/lib/services/account-deletion.ts",
    "src/lib/services/account-deletion.test.ts",
    "src/lib/supabase-admin.ts",
    "src/lib/supabase-admin.test.ts",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/supabase-admin", "@/lib/supabase-admin"],
            message:
              "The Supabase secret key must stay isolated to the account-deletion path. Import what you need from @/lib/services/account-deletion instead.",
          },
        ],
      },
    ],
  },
});

const reactConfig = tseslint.config({
  files: ["**/*.{js,jsx,ts,tsx}"],
  extends: [pluginReact.configs.flat.recommended],
  languageOptions: {
    ...pluginReact.configs.flat.recommended.languageOptions,
    globals: {
      window: true,
      document: true,
    },
  },
  plugins: {
    "react-hooks": eslintPluginReactHooks,
    "react-compiler": reactCompiler,
  },
  settings: { react: { version: "detect" } },
  rules: {
    ...eslintPluginReactHooks.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
    "react-compiler/react-compiler": "error",
  },
});

const astroConfig = tseslint.config({
  files: ["**/*.astro"],
  rules: {
    "astro/no-set-html-directive": "error",
    "astro/no-unused-css-selector": "warn",
    "astro/prefer-class-list-directive": "warn",
    // astro-eslint-parser models a top-level frontmatter `return` (the idiomatic
    // page-redirect pattern) without a function parent, which crashes this typed rule
    // (nullThrows: "Expected node to have a parent"). Server-only frontmatter, so off here.
    "@typescript-eslint/no-misused-promises": "off",
  },
});

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  // Supabase-generated DB types use their own formatting; exclude from lint/format.
  { ignores: ["src/db/database.types.ts"] },
  baseConfig,
  secretKeyFenceConfig,
  reactConfig,
  eslintPluginAstro.configs["flat/recommended"],
  ...eslintPluginAstro.configs["flat/jsx-a11y-recommended"],
  astroConfig,
  eslintPluginPrettier,
);
