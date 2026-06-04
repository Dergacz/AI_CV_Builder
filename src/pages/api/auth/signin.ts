import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const AUTH_UNAVAILABLE_MESSAGE = "Account access is temporarily unavailable. Please try again later.";
const SIGNIN_FAILED_MESSAGE = "We couldn't sign you in. Check your email and password, then try again.";
const RATE_LIMIT_MESSAGE = "Too many account attempts right now. Please wait a bit and try again.";

function getSignInErrorMessage(error: { status?: number; code?: string }) {
  if (error.status === 429 || error.code?.includes("rate_limit")) {
    return RATE_LIMIT_MESSAGE;
  }

  return SIGNIN_FAILED_MESSAGE;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(AUTH_UNAVAILABLE_MESSAGE)}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(getSignInErrorMessage(error))}`);
  }

  return context.redirect("/dashboard");
};
