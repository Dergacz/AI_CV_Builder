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
