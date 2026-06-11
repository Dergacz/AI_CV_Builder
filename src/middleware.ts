import { defineMiddleware } from "astro:middleware";
import { UI_LOCALE_COOKIE, resolveUiLocale } from "@/lib/i18n/locales";
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

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
