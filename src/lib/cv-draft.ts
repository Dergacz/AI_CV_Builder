import { z } from "zod";

/**
 * Runtime contract for the generated CV draft.
 *
 * This schema is the single source of truth for the `GeneratedCvDraft` shape:
 * `src/types.ts` re-exports the inferred types so the service, API route, and UI
 * all agree on one definition. It mirrors the F-01 decision contract field-for-field
 * (`context/changes/generation-export-decision-contract/decision-contract.md`).
 */

export const summarySectionSchema = z.object({
  headline: z.string().optional(),
  body: z.string(),
});

export const experienceItemSchema = z.object({
  role: z.string().optional(),
  organization: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string(),
  highlights: z.array(z.string()),
});

export const educationItemSchema = z.object({
  institution: z.string().optional(),
  program: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
});

export const skillGroupSchema = z.object({
  label: z.string(),
  // The contract requires at least one skill when a group exists.
  items: z.array(z.string()).min(1),
});

export const languageItemSchema = z.object({
  name: z.string(),
  proficiency: z.string().optional(),
});

export const draftAssumptionSchema = z.object({
  field: z.string(),
  reason: z.string(),
});

export const draftWarningCodeSchema = z.enum([
  "minimal_input",
  "missing_experience",
  "missing_education",
  "missing_skills",
  "missing_languages",
  "low_confidence",
]);

export const draftWarningSchema = z.object({
  code: draftWarningCodeSchema,
  message: z.string(),
});

export const generatedCvDraftSchema = z.object({
  schemaVersion: z.literal(1),
  language: z.enum(["en", "pl", "ru"]),
  source: z.object({
    questionnaireVersion: z.string(),
    generatedAt: z.string(),
    modelProvider: z.string().optional(),
    modelName: z.string().optional(),
  }),
  sections: z.object({
    summary: summarySectionSchema,
    experience: z.array(experienceItemSchema),
    education: z.array(educationItemSchema),
    skills: z.array(skillGroupSchema),
    languages: z.array(languageItemSchema),
  }),
  assumptions: z.array(draftAssumptionSchema),
  warnings: z.array(draftWarningSchema),
});

export type SummarySection = z.infer<typeof summarySectionSchema>;
export type ExperienceItem = z.infer<typeof experienceItemSchema>;
export type EducationItem = z.infer<typeof educationItemSchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type LanguageItem = z.infer<typeof languageItemSchema>;
export type DraftAssumption = z.infer<typeof draftAssumptionSchema>;
export type DraftWarningCode = z.infer<typeof draftWarningCodeSchema>;
export type DraftWarning = z.infer<typeof draftWarningSchema>;
export type GeneratedCvDraft = z.infer<typeof generatedCvDraftSchema>;

/**
 * User-facing failure buckets from the F-01 contract. S-04 exercises
 * `generation_failed` and `service_unavailable`; `export_failed` is owned by S-07
 * but kept here so the bucket set stays complete.
 */
export type GenerationErrorBucket = "generation_failed" | "export_failed" | "service_unavailable";

/** Human-friendly default copy for each bucket (no provider/internal detail leaks). */
export const generationErrorMessages: Record<GenerationErrorBucket, string> = {
  generation_failed: "We couldn't build your CV draft from these answers. Please try again.",
  export_failed: "We couldn't export your CV. Your edits are safe — please try again.",
  service_unavailable: "CV generation is temporarily unavailable. Please try again in a little while.",
};

/** Discriminated result returned by the generation service and the API route. */
export type GenerateDraftResponse =
  | { ok: true; draft: GeneratedCvDraft }
  | { ok: false; error: GenerationErrorBucket; message: string };
