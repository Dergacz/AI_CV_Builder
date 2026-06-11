import { POSTHOG_API_KEY, SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    name: "PostHog",
    configured: Boolean(POSTHOG_API_KEY),
    message: "PostHog nie jest skonfigurowany — analityka produktu i monitoring błędów są wyłączone.",
    docsUrl: "https://posthog.com/docs",
    docsLabel: "Zobacz dokumentację PostHog",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
