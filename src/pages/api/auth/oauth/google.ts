import type { APIRoute } from "astro";
import { setConsentCookie } from "@/lib/auth/consent-cookie";
import { classifyAuthError } from "@/lib/i18n/auth-errors";
import { createClient } from "@/lib/supabase";

export const prerender = false;

/**
 * Starts the Google OAuth redirect. The signup-page button carries `intent=signup` plus the
 * consent checkbox; the signin-page button carries `intent=signin` with no consent affordance.
 * For a consented signup we persist consent in a short-lived signed cookie (read later by
 * `/auth/callback` to stamp a brand-new account) before handing off to Google. `signInWithOAuth`
 * runs server-side here (PKCE + SSR cookies), returning the provider URL we redirect the browser to.
 */
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const intent = form.get("intent") === "signup" ? "signup" : "signin";

  // Consent gate for new-account creation: an unchecked checkbox sends no field, so absent/falsy
  // means not-consented. Reject before touching Supabase or setting any cookie.
  if (intent === "signup" && !form.get("consent")) {
    return context.redirect("/auth/signup?error=consent_required");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signin?error=auth_unavailable");
  }

  if (intent === "signup") {
    await setConsentCookie(context.cookies);
  }

  const redirectTo = new URL("/auth/callback", context.url).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return context.redirect(`/auth/signin?error=${classifyAuthError(error ?? {}, "auth_unavailable")}`);
  }

  return context.redirect(data.url, 303);
};
