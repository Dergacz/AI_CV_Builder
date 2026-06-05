import { describe, expect, it } from "vitest";

import { isClean, validateLanguage, validateSkillGroup, validateSummary } from "@/lib/cv-draft-validation";

describe("validateSummary", () => {
  it("rejects an empty or whitespace-only body", () => {
    expect(validateSummary({ body: "" }).body).toBeDefined();
    expect(validateSummary({ body: "   " }).body).toBeDefined();
  });

  it("accepts a non-empty body regardless of the optional headline", () => {
    expect(isClean(validateSummary({ body: "A short professional summary." }))).toBe(true);
    expect(isClean(validateSummary({ headline: "", body: "Has content." }))).toBe(true);
  });
});

describe("validateSkillGroup", () => {
  it("rejects an empty label", () => {
    expect(validateSkillGroup({ label: "", items: ["Excel"] }).label).toBeDefined();
  });

  it("rejects a group with no non-empty items", () => {
    expect(validateSkillGroup({ label: "Tools", items: [] }).items).toBeDefined();
    expect(validateSkillGroup({ label: "Tools", items: ["", "  "] }).items).toBeDefined();
  });

  it("accepts a labelled group with at least one real item", () => {
    expect(isClean(validateSkillGroup({ label: "Tools", items: ["", "Figma"] }))).toBe(true);
  });
});

describe("validateLanguage", () => {
  it("rejects an empty name", () => {
    expect(validateLanguage({ name: "" }).name).toBeDefined();
    expect(validateLanguage({ name: "  " }).name).toBeDefined();
  });

  it("accepts a named language regardless of the optional proficiency", () => {
    expect(isClean(validateLanguage({ name: "English" }))).toBe(true);
    expect(isClean(validateLanguage({ name: "Polish", proficiency: "" }))).toBe(true);
  });
});
