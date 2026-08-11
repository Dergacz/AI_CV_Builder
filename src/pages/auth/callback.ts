import type { APIRoute } from "astro";
import { clearConsentCookie, readConsentCookie } from "@/lib/auth/consent-cookie";
import { track } from "@/lib/observability";
import { createClient } from "@/lib/supabase";

export const prerender = false;

/**
 * OAuth callback: completes the Google round-trip started by /api/auth/oauth/google.
 *
 * Supabase auto-links a Google identity to an existing account when the verified email matches, so
 * "new vs returning" here is decided by whether the resolved account already carries a consent
 * stamp: every consented account (password signup or a prior Google signup) has
 * `consent_version` in its metadata, and an auto-linked account inherits the existing one. A
 * brand-new Google account has none — for it we require the consent cookie set before the redirect,
 * stamp consent onto the account, and emit the signup funnel event once (tagged method=google).
 * Missing consent on a new account fails closed: sign out and bounce to the consent-gated signup.
 */
export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");
  const providerError = context.url.searchParams.get("error");

  if (providerError || !code) {
    return context.redirect("/auth/signin?error=oauth_failed");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signin?error=auth_unavailable");
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return context.redirect("/auth/signin?error=oauth_failed");
  }

  const metadata = data.user.user_metadata as Record<string, unknown>;
  const alreadyConsented = typeof metadata.consent_version === "string" && metadata.consent_version.length > 0;

  if (!alreadyConsented) {
    const consent = await readConsentCookie(context.cookies);
    if (!consent) {
      // New account with no recorded consent — fail closed: drop the session and route to the
      // consent-gated signup button rather than letting an un-consented account into the app.
      clearConsentCookie(context.cookies);
      await supabase.auth.signOut();
      return context.redirect("/auth/signup?error=consent_required");
    }
    await supabase.auth.updateUser({
      data: { consent_version: consent.version, consent_accepted_at: consent.acceptedAt },
    });
    await track(
      "funnel_signup_completed",
      { locale: context.locals.locale, method: "google" },
      context.locals.observability,
    );
  }

  clearConsentCookie(context.cookies);
  return context.redirect("/dashboard");
};
