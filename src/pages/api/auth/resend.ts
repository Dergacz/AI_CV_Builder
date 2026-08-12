import type { APIRoute } from "astro";
import { z } from "zod";
import { emailConfirmRedirectUrl } from "@/lib/auth/email-redirect";
import { classifyAuthError } from "@/lib/i18n/auth-errors";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const resendSchema = z.object({
  email: z.email().trim(),
});

function confirmEmailRedirect(email: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ email, ...params });
  return `/auth/confirm-email?${searchParams.toString()}`;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = resendSchema.safeParse({ email: form.get("email") });

  if (!parsed.success) {
    return context.redirect("/auth/confirm-email?status=error");
  }

  const { email } = parsed.data;
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/confirm-email?status=unavailable");
  }

  // Same destination as the original signup mail (S-10): this is the recovery path for a user whose
  // first link was broken, so it must not hand them a second broken one.
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailConfirmRedirectUrl(context.url) },
  });
  if (error) {
    const code = classifyAuthError(error, "signup_failed");
    if (code === "rate_limited") {
      return context.redirect(confirmEmailRedirect(email, { error: code }));
    }

    return context.redirect(confirmEmailRedirect(email, { status: "error" }));
  }

  return context.redirect(confirmEmailRedirect(email, { status: "sent" }));
};
