import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

/**
 * Landing route for the confirmation link in the signup email — the `emailRedirectTo` built by
 * `emailConfirmRedirectUrl` in `src/lib/auth/email-redirect.ts`.
 *
 * By the time the browser reaches this route GoTrue has already verified the address — its `/verify`
 * endpoint confirms first and redirects second. What is still open is whether *this* browser can be
 * signed in: the PKCE exchange needs the code verifier cookie stored at signup, which exists only in
 * the browser that registered. A user who signs up on a laptop and opens the mail on a phone will
 * therefore fail the exchange with a fully confirmed account — so a failed exchange routes to the
 * sign-in page with a success notice, never with an error.
 *
 * A missing code or an `error` param is the other shape: an expired or already-used link. That one
 * really does need a new email, which is what the existing `email_not_confirmed` copy tells the user.
 *
 * Consent is not handled here (unlike `/auth/callback`): a password signup stamps it at registration.
 */
export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get("code");
  const providerError = context.url.searchParams.get("error");

  if (providerError || !code) {
    return context.redirect("/auth/signin?error=email_not_confirmed");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signin?error=auth_unavailable");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return context.redirect("/auth/signin?notice=email_confirmed");
  }

  return context.redirect("/dashboard");
};
