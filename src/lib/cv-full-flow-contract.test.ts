import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { generatedCvDraftSchema, type GeneratedCvDraft } from "@/lib/cv-draft";
import { getCvEditorCopy } from "@/lib/cv-editor-copy";
import { getCvExportCopy } from "@/lib/cv-export-copy";
import { buildCvPdfFilename } from "@/lib/cv-export-filename";
import { defaultCvTitle } from "@/lib/cv-library-copy";
import {
  QUESTIONNAIRE_VERSION,
  cvOutputLanguages,
  type CvOutputLanguage,
  type CvQuestionnaireAnswers,
} from "@/lib/cv-questionnaire";
import { buildCvInsert } from "@/lib/services/cv-repository";
import type { SourceSnapshot } from "@/types";

const fixtureDraft = generatedCvDraftSchema.parse(
  JSON.parse(readFileSync("context/changes/generation-export-decision-contract/cv-contract.fixture.json", "utf-8")),
);

function answersFor(outputLanguage: CvOutputLanguage): CvQuestionnaireAnswers {
  return {
    fullName: "Ada Lovelace",
    targetRoleOrGoal: "Customer Support Specialist",
    outputLanguage,
    experience: "Helped customers and organized support requests.",
    education: "General education.",
    skillsAndTools: "Email, spreadsheets, customer communication.",
    spokenLanguages: "English, Polish",
    additionalContext: "",
  };
}

function draftFor(language: CvOutputLanguage): GeneratedCvDraft {
  return {
    ...fixtureDraft,
    language,
    source: {
      ...fixtureDraft.source,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
    },
  };
}

describe("S-08 full saved PDF flow contract", () => {
  it("mirrors the selected output language into the saved row and source snapshot", () => {
    for (const outputLanguage of cvOutputLanguages) {
      const draft = draftFor(outputLanguage);
      const answers = answersFor(outputLanguage);
      const row = buildCvInsert("user-123", { draft, answers });
      const savedDraft = row.draft as unknown as GeneratedCvDraft;
      const sourceSnapshot = row.source_snapshot as unknown as SourceSnapshot;

      expect(savedDraft.language).toBe(outputLanguage);
      expect(row.language).toBe(outputLanguage);
      expect(sourceSnapshot.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
      expect(sourceSnapshot.answers.outputLanguage).toBe(outputLanguage);
      expect(sourceSnapshot.answers).toEqual(answers);
    }
  });

  it("keeps default saved titles durable and independent from output language", () => {
    const date = new Date("2026-06-07T12:00:00.000Z");
    const titles = cvOutputLanguages.map((outputLanguage) => defaultCvTitle(answersFor(outputLanguage), date));

    expect(new Set(titles)).toEqual(new Set(["Customer Support Specialist — 2026-06-07"]));
    expect(defaultCvTitle({ ...answersFor("ru"), fullName: "", targetRoleOrGoal: "" }, date)).toBe("CV — 2026-06-07");
  });

  it("derives export filenames from durable CV metadata, not interface locale", () => {
    const meta = { title: "Główny Księgowy", fullName: "Ада Лавлейс" };

    expect(buildCvPdfFilename(meta)).toBe("główny-księgowy.pdf");
    expect(buildCvPdfFilename({ title: "", fullName: meta.fullName })).toBe("ада-лавлейс.pdf");
    expect(buildCvPdfFilename({ title: "", fullName: "" })).toBe("cv.pdf");
  });

  it("keeps PDF content language separate from export UI language", () => {
    const polishUi = getCvExportCopy("pl").action.export;
    const englishPdf = getCvEditorCopy("en").sections.summary;
    const englishUi = getCvExportCopy("en").action.export;
    const russianPdf = getCvEditorCopy("ru").sections.summary;

    expect(polishUi).toBe("Eksportuj PDF");
    expect(englishPdf).toBe("Summary");
    expect(englishUi).toBe("Export PDF");
    expect(russianPdf).toBe("Резюме");
    expect(polishUi).not.toBe(englishPdf);
    expect(englishUi).not.toBe(russianPdf);
  });
});
