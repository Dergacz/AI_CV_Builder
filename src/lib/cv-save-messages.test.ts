import { describe, expect, it } from "vitest";

import { cvSaveErrorMessages, getCvSaveErrorMessages, type CvSaveErrorBucket } from "@/lib/cv-save-messages";

/**
 * Save message-bucket coverage (F-02, plan phase 2).
 *
 * The save routes return a stable `error` bucket; the client localizes it through
 * `getCvSaveErrorMessages`. This locks every bucket to a non-empty, distinct, localized
 * string so a gate that introduces a new save error surfaces real copy, not a blank.
 */

const buckets: CvSaveErrorBucket[] = [
  "save_failed",
  "load_failed",
  "delete_failed",
  "not_found",
  "service_unavailable",
];
const locales = ["en", "pl", "ru"] as const;

describe("cv-save-messages", () => {
  it("maps every bucket to a non-empty, distinct message in each locale", () => {
    for (const locale of locales) {
      const catalog = getCvSaveErrorMessages(locale);
      const seen = new Set<string>();
      for (const bucket of buckets) {
        const message = catalog[bucket];
        expect(message.trim().length).toBeGreaterThan(0);
        seen.add(message);
      }
      expect(seen.size).toBe(buckets.length);
    }
  });

  it("returns the English catalog as the server-facing default", () => {
    expect(getCvSaveErrorMessages("en")).toBe(cvSaveErrorMessages);
  });

  it("localizes the not_found copy differently from English", () => {
    expect(getCvSaveErrorMessages("pl").not_found).not.toBe(cvSaveErrorMessages.not_found);
    expect(getCvSaveErrorMessages("ru").not_found).not.toBe(cvSaveErrorMessages.not_found);
  });
});
