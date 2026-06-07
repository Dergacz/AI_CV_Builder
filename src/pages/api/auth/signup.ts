import type { APIRoute } from "astro";
import { classifyAuthError } from "@/lib/i18n/auth-errors";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signup?error=auth_unavailable");
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${classifyAuthError(error, "signup_failed")}`);
  }

  if (data.session) {
    return context.redirect("/dashboard");
  }

  return context.redirect("/auth/confirm-email");
};
