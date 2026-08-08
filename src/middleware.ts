import { defineMiddleware } from "astro:middleware";
import { UI_LOCALE_COOKIE, resolveUiLocale } from "@/lib/i18n/locales";
import { trackEmailConfirmedOnce } from "@/lib/observability/funnel";
import { resolveRequestIdentity } from "@/lib/observability/identity";
import { scheduleEmit, scheduleErrorReport } from "@/lib/observability/schedule";
import { createClient, safeGetUser } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/cv"];

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.locale = resolveUiLocale(context.cookies.get(UI_LOCALE_COOKIE)?.value);

  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    context.locals.user = await safeGetUser(supabase);
  } else {
    context.locals.user = null;
  }

  // Resolve the request's observability distinct_id once so every server emit point and the
  // client init (threaded via Layout) share a single id. See resolveRequestIdentity.
  context.locals.observability = await resolveRequestIdentity(context.locals.user, context.cookies);

  // Funnel step 3: emit email-confirmed on the first authenticated request after confirmation
  // (guarded once-only). The marker cookie is set synchronously inside the helper before the
  // PostHog fetch, so we fire-and-forget the emit — via Cloudflare's waitUntil when available,
  // else let it run detached (dev/node) — to keep the up-to-1.5s round-trip off the response path.
  scheduleEmit(
    trackEmailConfirmedOnce(context.locals.user, context.cookies, context.locals.observability, context.locals.locale),
    context.locals,
  );

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    const user = context.locals.user;
    if (!user) {
      return context.redirect("/auth/signin");
    }
    if (!user.email_confirmed_at) {
      return context.redirect(`/auth/confirm-email?email=${encodeURIComponent(user.email ?? "")}`);
    }
  }

  // S-07 catch-all: anything thrown out of a route or a downstream middleware. This is the only
  // thing that makes coverage rot-proof — routes added later are reported without opting in, and
  // an *unhandled* throw (the worst kind, since no bucket was chosen for it) can no longer vanish.
  // Routes that catch internally and return their own 500 never reach here; those report at their
  // own call sites, with a precise location.
  try {
    return await next();
  } catch (error) {
    // `routePattern` (e.g. "/api/cv/[id]") rather than `url.pathname` — the pattern is
    // low-cardinality and, crucially, content-free: a real pathname would carry CV ids into the
    // monitor, which is exactly the identifier leakage F-01's contract exists to prevent.
    scheduleErrorReport(error, { error_location: "middleware:unhandled", route: context.routePattern }, context.locals);
    // Re-throw the ORIGINAL value, not a wrapped one: Astro's error handling (dev overlay, 500
    // response) is downstream of this, and must behave exactly as it did before S-07.
    throw error;
  }
});
