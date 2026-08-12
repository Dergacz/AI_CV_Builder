import { SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID } from "astro:env/server";

/**
 * Whether the Google sign-in surface can succeed on this deployment.
 *
 * Both the auth pages and the OAuth start endpoint consult this: without it they would offer a
 * "Continue with Google" button that hands the browser to Supabase's `/authorize`, which rejects
 * an unconfigured provider with "Unsupported provider" — outside our app, past any error handling
 * we own. That dead end is worse than no button at all (the same reasoning as `isAdminConfigured`
 * in `src/lib/supabase-admin.ts`, and see `src/pages/account.astro`).
 *
 * Why the client id, and why only its presence:
 *
 *   - It is the same variable `supabase/config.toml` substitutes into `[auth.external.google]`, so
 *     a developer who follows the README setup gets a working button with no second step, and
 *     there is no way to configure the credentials without also setting the signal.
 *   - Validity cannot be checked without a provider round-trip, which would put a network call on
 *     every anonymous auth-page render. Presence is what distinguishes "someone configured this"
 *     from "nobody did" — a garbage client id still dead-ends, and that is accepted.
 *
 * Absence is a valid deployment state (local dev without Google credentials, and any environment
 * where the variable was not set), so this is a predicate rather than a throw.
 */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID?.trim());
}
