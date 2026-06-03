import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const AUTH_UNAVAILABLE_MESSAGE = "Account access is temporarily unavailable. Please try again later.";
const SIGNUP_FAILED_MESSAGE = "We couldn't create your account. Check your details, then try again.";
const RATE_LIMIT_MESSAGE = "Too many account attempts right now. Please wait a bit and try again.";

function getSignUpErrorMessage(error: { status?: number; code?: string }) {
  if (error.status === 429 || error.code?.includes("rate_limit")) {
    return RATE_LIMIT_MESSAGE;
  }

  return SIGNUP_FAILED_MESSAGE;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(AUTH_UNAVAILABLE_MESSAGE)}`);
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(getSignUpErrorMessage(error))}`);
  }

  if (data.session) {
    return context.redirect("/dashboard");
  }

  return context.redirect("/auth/confirm-email");
};
