import { defineMiddleware } from "astro:middleware";
import { UI_LOCALE_COOKIE, resolveUiLocale } from "@/lib/i18n/locales";
import { resolveRequestIdentity } from "@/lib/observability/identity";
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

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
