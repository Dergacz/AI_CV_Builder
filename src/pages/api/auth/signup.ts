import type { APIRoute } from "astro";
import { classifyAuthError } from "@/lib/i18n/auth-errors";
import { track } from "@/lib/observability";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  // Consent gate (unbypassable): an unchecked checkbox sends no field at all, so absent/falsy
  // means not-consented. Reject before any Supabase call so no account is created.
  if (!form.get("consent")) {
    return context.redirect("/auth/signup?error=consent_required");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signup?error=auth_unavailable");
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${classifyAuthError(error, "signup_failed")}`);
  }

  // Funnel step 2: registration succeeded (anonymous segment — no user session resolved yet, so
  // identity is the anon-session id). Covers both the confirm-email and auto-session success paths.
  await track("funnel_signup_completed", { locale: context.locals.locale }, context.locals.observability);

  if (data.session) {
    return context.redirect("/dashboard");
  }

  return context.redirect(`/auth/confirm-email?email=${encodeURIComponent(email)}`);
};
