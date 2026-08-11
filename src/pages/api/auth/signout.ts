import type { APIRoute } from "astro";
import { scheduleErrorReport } from "@/lib/observability/schedule";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // S-07: this was a pre-F-01 `console.warn`, which only ever reached Worker logs. A failed
      // sign-out leaves the user holding a live session they asked us to end — our defect, and one
      // the user cannot report usefully. Only the error type and location leave; `error.message`
      // (which carried provider detail) deliberately no longer goes anywhere.
      scheduleErrorReport(error, { error_location: "api/auth/signout:signout" }, context.locals);
      return context.redirect("/dashboard?signout_error=1");
    }
  }
  return context.redirect("/");
};
