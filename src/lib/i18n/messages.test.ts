import { describe, expect, it } from "vitest";

import { uiLocales, type UiLocale } from "@/lib/i18n/locales";
import { messagesByLocale, getMessages } from "@/lib/i18n/messages";
import { landingContentByLocale } from "@/lib/landing-content";
import { cvEditorCopyByLocale } from "@/lib/cv-editor-copy";
import { cvLibraryCopyByLocale } from "@/lib/cv-library-copy";
import { cvExportCopyByLocale } from "@/lib/cv-export-copy";
import { generationErrorMessagesByLocale } from "@/lib/cv-draft-messages";
import { cvSaveErrorMessagesByLocale } from "@/lib/cv-save-messages";

/**
 * Collect the sorted set of leaf key-paths for an object, treating functions as leaves.
 * Used to prove every locale has structurally identical catalog coverage — a missing or
 * extra branch in one locale surfaces as a key-path set mismatch.
 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return [prefix];
  return entries
    .flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort((a, b) => a.localeCompare(b));
}

const catalogs: Record<string, Record<UiLocale, unknown>> = {
  messages: messagesByLocale,
  landing: landingContentByLocale,
  editor: cvEditorCopyByLocale,
  library: cvLibraryCopyByLocale,
  export: cvExportCopyByLocale,
  generationErrors: generationErrorMessagesByLocale,
  saveErrors: cvSaveErrorMessagesByLocale,
};

describe("i18n catalog coverage", () => {
  it("defines every supported UI locale", () => {
    expect([...uiLocales]).toEqual(["en", "pl", "ru"]);
  });

  for (const [name, byLocale] of Object.entries(catalogs)) {
    it(`has identical key coverage across locales for the ${name} catalog`, () => {
      const reference = keyPaths(byLocale.en);
      expect(reference.length).toBeGreaterThan(0);
      for (const locale of uiLocales) {
        expect({ locale, keys: keyPaths(byLocale[locale]) }).toEqual({ locale, keys: reference });
      }
    });
  }

  it("exposes the required top-level message groups for every locale", () => {
    const required = ["shell", "auth", "dashboard", "cvPages", "questionnaire"] as const;
    for (const locale of uiLocales) {
      const messages = getMessages(locale);
      for (const group of required) {
        expect(messages[group]).toBeTruthy();
      }
    }
  });

  it("localizes representative required strings per locale (no English bleed-through)", () => {
    // Sanity check that pl/ru are not silently falling back to English copy.
    expect(getMessages("pl").questionnaire.buttons.back).toBe("Wstecz");
    expect(getMessages("ru").questionnaire.buttons.back).toBe("Назад");
    expect(cvEditorCopyByLocale.pl.actions.save).toBe("Zapisz");
    expect(cvEditorCopyByLocale.ru.actions.save).toBe("Сохранить");
    expect(cvLibraryCopyByLocale.pl.card.open).toBe("Otwórz");
    expect(cvLibraryCopyByLocale.ru.card.open).toBe("Открыть");
  });

  it("provides localized Google sign-in button copy for every locale", () => {
    // The "Continue with Google" button (plan phase 4) and its divider must be present and
    // genuinely localized — not silently falling back to English in pl/ru.
    expect(getMessages("en").auth.google.button).toBe("Continue with Google");
    expect(getMessages("pl").auth.google.button).toBe("Kontynuuj z Google");
    expect(getMessages("ru").auth.google.button).toBe("Продолжить с Google");

    expect(getMessages("en").auth.google.divider).toBe("or");
    expect(getMessages("pl").auth.google.divider).toBe("lub");
    expect(getMessages("ru").auth.google.divider).toBe("или");
  });

  it("provides output-language display names in each interface locale", () => {
    for (const locale of uiLocales) {
      const names = getMessages(locale).questionnaire.outputLanguageNames;
      for (const lang of uiLocales) {
        expect(names[lang].length).toBeGreaterThan(0);
      }
    }
  });
});
