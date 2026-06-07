import type { APIRoute } from "astro";

import { UI_LOCALE_COOKIE, resolveUiLocale } from "@/lib/i18n/locales";

export const prerender = false;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const locale = resolveUiLocale(form.get("locale"));

  context.cookies.set(UI_LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: ONE_YEAR_SECONDS,
  });

  return context.redirect(safeReturnTo(form.get("returnTo")));
};
