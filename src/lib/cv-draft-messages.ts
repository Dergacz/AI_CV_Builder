/**
 * User-facing generation error copy — zod-free on purpose.
 *
 * Lives apart from `cv-draft.ts` (which imports zod) so the client island can
 * import the *values* here without pulling zod into the browser bundle.
 * `cv-draft.ts` re-exports these so server code keeps a single import surface.
 */

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
