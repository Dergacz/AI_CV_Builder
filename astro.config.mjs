// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      // S-08 account deletion. The Supabase SECRET (service-role) key — it bypasses RLS, so it is
      // read by exactly one module (src/lib/supabase-admin.ts, guarded by an ESLint fence) and is
      // never exposed to the client. Optional like every other secret here: when it is absent the
      // deletion surface fails closed (503 + "unavailable") rather than the app failing to boot.
      SUPABASE_SECRET_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENAI_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      OPENAI_MODEL: envField.string({ context: "server", access: "public", optional: true }),
      POSTHOG_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      POSTHOG_HOST: envField.string({ context: "server", access: "public", optional: true }),
      OBSERVABILITY_ID_SALT: envField.string({ context: "server", access: "secret", optional: true }),
      OBSERVABILITY_SMOKE_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      // S-06 abuse guards. Defaults live in src/lib/services/generation-quota.ts, not here, so
      // an unset var and an unparseable one behave identically.
      GENERATION_DAILY_LIMIT: envField.number({ context: "server", access: "public", optional: true }),
      GENERATION_HOURLY_CEILING: envField.number({ context: "server", access: "public", optional: true }),
      PUBLIC_POSTHOG_KEY: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_POSTHOG_HOST: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
});
