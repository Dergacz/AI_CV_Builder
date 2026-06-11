import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Deliberate breadcrumb: surface the swallowed sign-out failure to runtime
      // logs / monitoring instead of redirecting home as a silent success.
      // eslint-disable-next-line no-console
      console.warn(`auth/signout: signout_failed ${error.message}`);
      return context.redirect("/dashboard?signout_error=1");
    }
  }
  return context.redirect("/");
};
