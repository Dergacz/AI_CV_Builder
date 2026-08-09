import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

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
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
