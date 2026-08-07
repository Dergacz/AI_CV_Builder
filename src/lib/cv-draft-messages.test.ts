import { describe, expect, it } from "vitest";

import { getGenerationErrorMessages, generationErrorMessages } from "@/lib/cv-draft-messages";
import { uiLocales } from "@/lib/i18n/locales";

/**
 * Generation error copy contract (S-06 additions).
 *
 * Guards two rules the type system cannot express:
 *   1. Every locale resolves `daily_limit_reached` to real, distinct copy — a missing translation
 *      would otherwise silently show the user an unrelated "temporarily unavailable" message.
 *   2. The wall copy names no figure. Both limits are env-tunable, so a hardcoded "100" would start
 *      lying the moment GENERATION_DAILY_LIMIT changes.
 */

describe("daily_limit_reached copy", () => {
  it.each(uiLocales)("resolves to non-empty copy in %s", (locale) => {
    expect(getGenerationErrorMessages(locale).daily_limit_reached.trim().length).toBeGreaterThan(0);
  });

  it.each(uiLocales)("is distinct from service_unavailable in %s", (locale) => {
    const copy = getGenerationErrorMessages(locale);

    expect(copy.daily_limit_reached).not.toBe(copy.service_unavailable);
  });

  it.each(uiLocales)("names no figure in %s — the limit is env-tunable", (locale) => {
    expect(getGenerationErrorMessages(locale).daily_limit_reached).not.toMatch(/\d/);
  });

  it("is actually translated per locale, not the English string repeated", () => {
    const rendered = uiLocales.map((locale) => getGenerationErrorMessages(locale).daily_limit_reached);

    expect(new Set(rendered).size).toBe(uiLocales.length);
  });

  it("exposes the English copy to the server as the response message", () => {
    expect(generationErrorMessages.daily_limit_reached).toBe(getGenerationErrorMessages("en").daily_limit_reached);
  });
});
