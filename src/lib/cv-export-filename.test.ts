import { describe, expect, it } from "vitest";

import { buildCvPdfFilename } from "@/lib/cv-export-filename";

describe("buildCvPdfFilename", () => {
  it("slugifies the title and appends .pdf", () => {
    expect(buildCvPdfFilename({ title: "Senior Data Analyst" })).toBe("senior-data-analyst.pdf");
  });

  it("collapses whitespace and punctuation into single hyphens", () => {
    expect(buildCvPdfFilename({ title: "  Front-End   Engineer / 2026!! " })).toBe("front-end-engineer-2026.pdf");
  });

  it("falls back to the full name when the title is empty or whitespace", () => {
    expect(buildCvPdfFilename({ title: "   ", fullName: "Ada Lovelace" })).toBe("ada-lovelace.pdf");
    expect(buildCvPdfFilename({ fullName: "Ada Lovelace" })).toBe("ada-lovelace.pdf");
  });

  it("falls back to cv.pdf when nothing usable is provided", () => {
    expect(buildCvPdfFilename({})).toBe("cv.pdf");
    expect(buildCvPdfFilename({ title: "—  !! ", fullName: "" })).toBe("cv.pdf");
  });

  it("preserves Cyrillic letters in the slug", () => {
    expect(buildCvPdfFilename({ title: "Резюме Аналитика" })).toBe("резюме-аналитика.pdf");
  });

  it("preserves Polish diacritics in the slug", () => {
    expect(buildCvPdfFilename({ title: "Główny Księgowy" })).toBe("główny-księgowy.pdf");
  });
});
