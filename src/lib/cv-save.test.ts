import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { generatedCvDraftSchema } from "@/lib/cv-draft";
import { cvAnswersSchema, cvSaveSchema } from "@/lib/cv-answers.schema";
import { defaultCvTitle } from "@/lib/cv-library-copy";
import { buildCvInsert } from "@/lib/services/cv-repository";
import { QUESTIONNAIRE_VERSION, type CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import type { SourceSnapshot } from "@/types";

// The F-01 contract fixture is a known-good draft; the save schema must accept it.
const fixtureDraft = JSON.parse(
  readFileSync("context/changes/generation-export-decision-contract/cv-contract.fixture.json", "utf-8"),
) as unknown;

const validAnswers: CvQuestionnaireAnswers = {
  fullName: "Ada Lovelace",
  targetRoleOrGoal: "Data Analyst",
  outputLanguage: "en",
  experience: "",
  education: "",
  skillsAndTools: "",
  spokenLanguages: "",
  additionalContext: "",
};

describe("cvAnswersSchema", () => {
  it("accepts valid answers and applies defaults for omitted optional fields", () => {
    const parsed = cvAnswersSchema.safeParse({
      fullName: "Ada",
      targetRoleOrGoal: "Analyst",
      outputLanguage: "en",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.experience).toBe("");
      expect(parsed.data.additionalContext).toBe("");
    }
  });

  it("rejects a missing required field and an unsupported language", () => {
    expect(cvAnswersSchema.safeParse({ targetRoleOrGoal: "Analyst", outputLanguage: "en" }).success).toBe(false);
    expect(
      cvAnswersSchema.safeParse({ fullName: "Ada", targetRoleOrGoal: "Analyst", outputLanguage: "de" }).success,
    ).toBe(false);
  });
});

describe("cvSaveSchema", () => {
  it("accepts the contract fixture draft with valid answers", () => {
    expect(generatedCvDraftSchema.safeParse(fixtureDraft).success).toBe(true);
    const parsed = cvSaveSchema.safeParse({ draft: fixtureDraft, answers: validAnswers });
    expect(parsed.success).toBe(true);
  });

  it("accepts an optional uuid id and title, and rejects a non-uuid id", () => {
    const base = { draft: fixtureDraft, answers: validAnswers };
    expect(
      cvSaveSchema.safeParse({ ...base, id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", title: "My CV" }).success,
    ).toBe(true);
    expect(cvSaveSchema.safeParse({ ...base, id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a malformed draft and a blank title", () => {
    expect(cvSaveSchema.safeParse({ draft: { schemaVersion: 1 }, answers: validAnswers }).success).toBe(false);
    expect(cvSaveSchema.safeParse({ draft: fixtureDraft, answers: validAnswers, title: "   " }).success).toBe(false);
  });
});

describe("defaultCvTitle", () => {
  const date = new Date("2026-06-06T12:00:00.000Z");

  it("uses the target role and an ISO date", () => {
    expect(defaultCvTitle(validAnswers, date)).toBe("Data Analyst — 2026-06-06");
  });

  it("truncates a very long role", () => {
    const longRole = "A".repeat(80);
    const title = defaultCvTitle({ ...validAnswers, targetRoleOrGoal: longRole }, date);
    expect(title).toContain("…");
    expect(title.endsWith("2026-06-06")).toBe(true);
    // 60 role chars + ellipsis, far short of the original 80.
    expect(title.length).toBeLessThan(longRole.length);
  });

  it("falls back to the full name when the role is empty", () => {
    expect(defaultCvTitle({ ...validAnswers, targetRoleOrGoal: "  " }, date)).toBe("Ada Lovelace's CV — 2026-06-06");
  });

  it("falls back to a bare label when role and name are empty", () => {
    expect(defaultCvTitle({ ...validAnswers, targetRoleOrGoal: "", fullName: "" }, date)).toBe("CV — 2026-06-06");
  });
});

describe("buildCvInsert (source_snapshot assembly)", () => {
  const draft = generatedCvDraftSchema.parse(fixtureDraft);

  it("sets owner, mirrors language from the draft, and snapshots the answers", () => {
    const row = buildCvInsert("user-123", { draft, answers: validAnswers });
    expect(row.user_id).toBe("user-123");
    expect(row.language).toBe(draft.language);

    const snapshot = row.source_snapshot as unknown as SourceSnapshot;
    expect(snapshot.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
    expect(snapshot.answers).toEqual(validAnswers);
    expect(() => new Date(snapshot.capturedAt).toISOString()).not.toThrow();
  });

  it("defaults the title from answers when none is provided, and keeps a provided title", () => {
    expect(buildCvInsert("u", { draft, answers: validAnswers }).title).toContain("Data Analyst");
    expect(buildCvInsert("u", { draft, answers: validAnswers, title: "Custom Title" }).title).toBe("Custom Title");
  });
});
