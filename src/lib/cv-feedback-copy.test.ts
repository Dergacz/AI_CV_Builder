import { describe, expect, it } from "vitest";

import { cvFeedbackCopyByLocale, getCvFeedbackCopy, type CvFeedbackCopy } from "@/lib/cv-feedback-copy";
import { uiLocales } from "@/lib/i18n/locales";

/**
 * Locale coverage for the feedback widget copy (S-05, plan phase 3).
 *
 * The widget renders every one of these strings, so a missing or blank key would ship
 * an empty button or an unlabelled region rather than fail loudly at runtime.
 */

const requiredKeys: (keyof CvFeedbackCopy)[] = [
  "title",
  "description",
  "helpful",
  "notHelpful",
  "commentLabel",
  "commentPlaceholder",
  "submit",
  "submitting",
  "thanks",
  "errorRetry",
  "regionAriaLabel",
  "verdictGroupAriaLabel",
];

describe("getCvFeedbackCopy", () => {
  it.each(uiLocales)("resolves non-empty copy for every key in %s", (locale) => {
    const copy = getCvFeedbackCopy(locale);

    for (const key of requiredKeys) {
      expect(copy[key].trim(), `${locale}.${key}`).not.toBe("");
    }
  });

  it("covers every UI locale with a distinct catalog", () => {
    expect(Object.keys(cvFeedbackCopyByLocale).sort()).toEqual([...uiLocales].sort());
    const verdicts = uiLocales.map((locale) => getCvFeedbackCopy(locale).helpful);
    expect(new Set(verdicts).size).toBe(uiLocales.length);
  });
});
