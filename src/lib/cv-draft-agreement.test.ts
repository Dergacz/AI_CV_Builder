import { describe, expect, it } from "vitest";

import {
  generatedCvDraftSchema,
  languageItemSchema,
  skillGroupSchema,
  summarySectionSchema,
  type GeneratedCvDraft,
} from "@/lib/cv-draft";
import { isClean, validateLanguage, validateSkillGroup, validateSummary } from "@/lib/cv-draft-validation";

/**
 * Agreement tests: the zod-free client guards must never accept a value that the zod schema
 * (the server-side source of truth) would reject. If these drift, a client-accepted Save could
 * produce a draft that fails downstream in S-06 (save) or S-07 (export).
 */

function baseDraft(): GeneratedCvDraft {
  return {
    schemaVersion: 1,
    language: "en",
    source: { questionnaireVersion: "questionnaire-v1", generatedAt: "2026-01-01T00:00:00.000Z" },
    sections: {
      summary: { body: "A short professional summary." },
      experience: [],
      education: [],
      skills: [],
      languages: [],
    },
    assumptions: [],
    warnings: [],
  };
}

describe("client guards ⊆ zod schema", () => {
  it("a summary the client accepts passes the summary schema", () => {
    const summary = { headline: "Headline", body: "Has content." };
    expect(isClean(validateSummary(summary))).toBe(true);
    expect(summarySectionSchema.safeParse(summary).success).toBe(true);
  });

  it("a skill group the client accepts passes the skill-group schema", () => {
    const group = { label: "Tools", items: ["Figma"] };
    expect(isClean(validateSkillGroup(group))).toBe(true);
    expect(skillGroupSchema.safeParse(group).success).toBe(true);
  });

  it("a language the client accepts passes the language schema", () => {
    const language = { name: "English" };
    expect(isClean(validateLanguage(language))).toBe(true);
    expect(languageItemSchema.safeParse(language).success).toBe(true);
  });

  it("a full draft assembled from client-accepted sections parses", () => {
    const draft = baseDraft();
    draft.sections.skills = [{ label: "Tools", items: ["Figma"] }];
    draft.sections.languages = [{ name: "English" }];
    expect(generatedCvDraftSchema.safeParse(draft).success).toBe(true);
  });
});

describe("shared required constraints are enforced both sides", () => {
  it("an empty skill group is rejected by the client guard and the schema", () => {
    const group = { label: "Tools", items: [] };
    expect(validateSkillGroup(group).items).toBeDefined();

    const draft = baseDraft();
    draft.sections.skills = [group];
    expect(generatedCvDraftSchema.safeParse(draft).success).toBe(false);
  });
});
