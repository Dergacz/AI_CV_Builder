import { z } from "zod";

/**
 * Server-only zod schema for the feedback submission payload.
 *
 * Privacy (F-01): `comment` is raw user content — validated here but never
 * forwarded to PostHog. Only `generationEventId` (UUID ≤ 36 chars) and
 * `helpful` (boolean) are allowlisted in the observability scrub.
 */
export const feedbackSchema = z.object({
  generationEventId: z.uuid(),
  helpful: z.boolean(),
  comment: z
    .string()
    .max(1000)
    .transform((v) => (v.trim() === "" ? undefined : v))
    .optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
