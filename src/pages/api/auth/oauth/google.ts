import type { APIRoute } from "astro";
import { setConsentCookie } from "@/lib/auth/consent-cookie";
import { isGoogleAuthConfigured } from "@/lib/auth/google-provider";
import { classifyAuthError } from "@/lib/i18n/auth-errors";
import { createClient } from "@/lib/supabase";

export const prerender = false;

/**
 * Starts the Google OAuth redirect. Both auth pages render the same button under a notice reading
 * "By continuing, you agree to the Terms of Service and Privacy Policy" — the click itself is the
 * act of consent, so this route takes no consent field and does not distinguish signin from signup.
 * Consent is persisted in a short-lived signed cookie on every start, read later by
 * `/auth/callback` to stamp a brand-new account. `signInWithOAuth` runs server-side here
 * (PKCE + SSR cookies), returning the provider URL we redirect the browser to.
 *
 * Setting the cookie unconditionally is what makes the callback's fail-closed branch a genuine
 * safety net: previously it was set only on the signup path, so a first-time visitor clicking the
 * button on `/auth/signin` completed the whole round-trip and was then signed out.
 *
 * The availability pre-check below is NOT redundant with the `error || !data.url` branch further
 * down: `signInWithOAuth` only *builds* an authorize URL — no network call, no provider validation
 * — so it always succeeds even when the provider is disabled. Without the pre-check the browser is
 * handed to Supabase's `/authorize`, which answers "Unsupported provider" outside our app entirely.
 * The route stays reachable by direct POST or stale HTML no matter what the auth pages rendered,
 * which is why hiding the button does not make this redundant either.
 */
export const POST: APIRoute = async (context) => {
  // Ordering is load-bearing: the availability gate runs before setConsentCookie, so a refused
  // start never leaves a signed consent cookie behind with no OAuth round-trip left to consume or
  // clear it.
  if (!isGoogleAuthConfigured()) {
    return context.redirect("/auth/signin?error=google_unavailable");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signin?error=auth_unavailable");
  }

  await setConsentCookie(context.cookies);

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
