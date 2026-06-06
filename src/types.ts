/**
 * Shared entity and DTO types for the app.
 *
 * The generated-CV-draft types are defined once in `src/lib/cv-draft.ts` (derived
 * from the zod schema, which is the single source of truth) and re-exported here so
 * consumers can import shared types from `@/types` per project convention.
 */
export type {
  GeneratedCvDraft,
  SummarySection,
  ExperienceItem,
  EducationItem,
  SkillGroup,
  LanguageItem,
  DraftAssumption,
  DraftWarning,
  DraftWarningCode,
  GenerationErrorBucket,
  GenerateDraftResponse,
} from "@/lib/cv-draft";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import type { CvOutputLanguage, CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

/**
 * Saved-CV entity and DTO types (F-02 persistence contract / S-06).
 *
 * `source_snapshot` captures the questionnaire answers that produced a draft —
 * these live outside `GeneratedCvDraft`, so they are threaded separately on save
 * and restored on reopen. Listable fields are kept flat (no draft) for the library.
 */

/** Snapshot of the inputs that produced a saved CV; stored as `cvs.source_snapshot`. */
export interface SourceSnapshot {
  questionnaireVersion: string;
  answers: CvQuestionnaireAnswers;
  capturedAt: string;
}

/** Library-listing shape — flat, content-free (no `draft`/`source_snapshot`). */
export interface SavedCvSummary {
  id: string;
  title: string;
  language: CvOutputLanguage;
  createdAt: string;
  updatedAt: string;
}

/** A fully-loaded saved CV, including the draft and its source snapshot. */
export interface SavedCv extends SavedCvSummary {
  draft: GeneratedCvDraft;
  sourceSnapshot: SourceSnapshot;
}
