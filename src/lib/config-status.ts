import { OBSERVABILITY_ID_SALT, POSTHOG_API_KEY, SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import { PUBLIC_POSTHOG_KEY } from "astro:env/client";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

/**
 * `message` and `docsLabel` are last-resort fallbacks: `Layout.astro` renders the
 * localized copy from `messages.shell.configBanner` and only falls back to these when a
 * status has no catalog entry. Keep them neutral English, not one interface locale.
 */
export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase is not configured — authentication and saved CVs are unavailable.",
    docsUrl: "https://github.com/Dergacz/AI_CV_Builder#environment-variables",
    docsLabel: "Setup instructions",
  },
  {
    name: "PostHog",
    // Require the full observability set: the server capture key, the pseudonymous-ID salt
    // (without it authenticated identity silently degrades to anon sessions), and the public
    // browser key (without it the client SDK is a no-op). A partial config surfaces the banner.
    configured: Boolean(POSTHOG_API_KEY && OBSERVABILITY_ID_SALT && PUBLIC_POSTHOG_KEY),
    message:
      "PostHog nie jest w pełni skonfigurowany — analityka produktu i monitoring błędów są wyłączone lub ograniczone.",
    docsUrl: "https://posthog.com/docs",
    docsLabel: "Zobacz dokumentację PostHog",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
