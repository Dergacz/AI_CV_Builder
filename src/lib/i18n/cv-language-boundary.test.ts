import { describe, expect, it } from "vitest";

import { uiLocales } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";
import { getCvEditorCopy } from "@/lib/cv-editor-copy";
import { defaultCvTitle } from "@/lib/cv-library-copy";
import { cvOutputLanguages, defaultCvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

/**
 * S-09 CV-language boundary: the interface locale and the CV output language are independent.
 * Changing the interface language must never change the exported/saved CV content language.
 */
describe("CV language boundary", () => {
  const date = new Date("2026-01-02T12:00:00Z");

  it("derives default saved titles independently of the interface locale", () => {
    // defaultCvTitle takes no locale argument: the same answers + date always yield the same title.
    const answers = { ...defaultCvQuestionnaireAnswers, targetRoleOrGoal: "Barista" };
    expect(defaultCvTitle(answers, date)).toBe("Barista — 2026-01-02");

    const named = { ...defaultCvQuestionnaireAnswers, fullName: "Anna Kowalska" };
    expect(defaultCvTitle(named, date)).toBe("Anna Kowalska — 2026-01-02");

    // No answers → neutral "CV" fallback (not interface copy).
    expect(defaultCvTitle(defaultCvQuestionnaireAnswers, date)).toBe("CV — 2026-01-02");
  });

  it("selects exported PDF section headings by the CV output language, not the interface locale", () => {
    // CvPdfDocument resolves headings via getCvEditorCopy(outputLanguage).
    expect(getCvEditorCopy("en").sections.summary).toBe("Summary");
    expect(getCvEditorCopy("pl").sections.summary).toBe("Podsumowanie");
    expect(getCvEditorCopy("ru").sections.summary).toBe("Резюме");

    // The same output language yields the same headings regardless of which interface locale
    // the user is viewing — the selector has a single (output-language) input.
    for (const outputLanguage of cvOutputLanguages) {
      const headings = getCvEditorCopy(outputLanguage).sections;
      expect(headings.summary.length).toBeGreaterThan(0);
      expect(headings.experience.length).toBeGreaterThan(0);
    }
  });

  it("localizes the output-language display label by interface locale while keying on the stored value", () => {
    // The label for output language "en" is rendered in the interface locale...
    expect(getMessages("en").questionnaire.outputLanguageNames.en).toBe("English");
    expect(getMessages("pl").questionnaire.outputLanguageNames.en).toBe("angielski");
    expect(getMessages("ru").questionnaire.outputLanguageNames.en).toBe("английский");

    // ...but it is always keyed by the stored output-language value (en/pl/ru), which never changes.
    for (const uiLocale of uiLocales) {
      const names = getMessages(uiLocale).questionnaire.outputLanguageNames;
      for (const stored of cvOutputLanguages) {
        expect(names[stored]).toBeTruthy();
      }
    }
  });

  it("keeps interface and output dimensions orthogonal (label differs across UI, key is stable)", () => {
    const stored = "ru"; // a saved CV whose content language is Russian
    const labels = uiLocales.map((uiLocale) => getMessages(uiLocale).questionnaire.outputLanguageNames[stored]);
    // Same stored value, but the human-readable label is localized per interface locale.
    expect(new Set(labels).size).toBeGreaterThan(1);
  });
});
