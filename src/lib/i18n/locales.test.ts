import { describe, expect, it } from "vitest";

import {
  UI_LOCALE_COOKIE,
  defaultUiLocale,
  isUiLocale,
  localeLabels,
  resolveUiLocale,
  uiLocales,
} from "@/lib/i18n/locales";

describe("UI locale contract", () => {
  it("defines the supported UI locales in stable order", () => {
    expect(uiLocales).toEqual(["en", "pl", "ru"]);
    expect(defaultUiLocale).toBe("en");
    expect(UI_LOCALE_COOKIE).toBe("ui_locale");
  });

  it("recognizes only supported locale values", () => {
    expect(isUiLocale("en")).toBe(true);
    expect(isUiLocale("pl")).toBe(true);
    expect(isUiLocale("ru")).toBe(true);
    expect(isUiLocale("de")).toBe(false);
    expect(isUiLocale("")).toBe(false);
    expect(isUiLocale(undefined)).toBe(false);
  });

  it("resolves unsupported or missing values to the default locale", () => {
    expect(resolveUiLocale("pl")).toBe("pl");
    expect(resolveUiLocale("ru")).toBe("ru");
    expect(resolveUiLocale("en-US")).toBe(defaultUiLocale);
    expect(resolveUiLocale(null)).toBe(defaultUiLocale);
    expect(resolveUiLocale(undefined)).toBe(defaultUiLocale);
  });

  it("provides labels for every locale", () => {
    for (const locale of uiLocales) {
      expect(localeLabels[locale].code).toBe(locale.toUpperCase());
      expect(typeof localeLabels[locale].name).toBe("string");
      expect(localeLabels[locale].name.length).toBeGreaterThan(0);
    }
  });
});
