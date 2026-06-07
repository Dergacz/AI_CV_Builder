export const uiLocales = ["en", "pl", "ru"] as const;

export type UiLocale = (typeof uiLocales)[number];

export const defaultUiLocale = "en" satisfies UiLocale;

export const UI_LOCALE_COOKIE = "ui_locale";

export const localeLabels = {
  en: {
    code: "EN",
    name: "English",
  },
  pl: {
    code: "PL",
    name: "Polski",
  },
  ru: {
    code: "RU",
    name: "Русский",
  },
} satisfies Record<UiLocale, { code: string; name: string }>;

export function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === "string" && uiLocales.includes(value as UiLocale);
}

export function resolveUiLocale(value: unknown): UiLocale {
  return isUiLocale(value) ? value : defaultUiLocale;
}
