import { z } from "zod";

import { cvOutputLanguages } from "@/lib/cv-questionnaire";
import { generatedCvDraftSchema } from "@/lib/cv-draft";

/**
 * Server-only zod schemas for questionnaire answers and the saved-CV save payload.
 *
 * Kept out of `cv-questionnaire.ts` so zod is not bundled into the client
 * questionnaire island. `cvAnswersSchema` output matches `CvQuestionnaireAnswers`;
 * `generate.ts` and the saved-CV save routes share it so validation never diverges.
 */

const MAX_SHORT_FIELD = 300;
const MAX_LONG_FIELD = 5000;

/** Max length of a saved-CV title (mirrors the `cvs.title` usage in F-02). */
export const MAX_CV_TITLE = 200;

export const cvAnswersSchema = z.object({
  fullName: z.string().trim().min(1).max(MAX_SHORT_FIELD),
  targetRoleOrGoal: z.string().trim().min(1).max(MAX_LONG_FIELD),
  outputLanguage: z.enum(cvOutputLanguages),
  experience: z.string().max(MAX_LONG_FIELD).optional().default(""),
  education: z.string().max(MAX_LONG_FIELD).optional().default(""),
  skillsAndTools: z.string().max(MAX_LONG_FIELD).optional().default(""),
  spokenLanguages: z.string().max(MAX_LONG_FIELD).optional().default(""),
  additionalContext: z.string().max(MAX_LONG_FIELD).optional().default(""),
});

/**
 * Save payload for create (POST) and update (PUT). `id` is ignored on the wire —
 * the route derives identity from the path/verb — but accepted so the client may
 * send it. `title` is optional; the repository fills a default when absent.
 * `draft` reuses the single-source-of-truth draft contract.
 */
export const cvSaveSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(MAX_CV_TITLE).optional(),
  draft: generatedCvDraftSchema,
  answers: cvAnswersSchema,
});

export type CvSaveInput = z.infer<typeof cvSaveSchema>;
