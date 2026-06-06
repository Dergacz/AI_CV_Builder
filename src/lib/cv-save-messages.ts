/**
 * User-facing saved-CV error copy — zod-free on purpose.
 *
 * Lives apart from server modules so client islands can import the *values* without
 * pulling zod or Supabase into the browser bundle. Mirrors `cv-draft-messages.ts`.
 * Messages never leak provider/internal/SQL detail (F-02 diagnostics rules).
 */

/** Stable failure buckets for save / list / reopen / delete. */
export type CvSaveErrorBucket = "save_failed" | "load_failed" | "delete_failed" | "not_found" | "service_unavailable";

/** Human-friendly default copy for each bucket. */
export const cvSaveErrorMessages: Record<CvSaveErrorBucket, string> = {
  save_failed: "We couldn't save your CV. Your edits are still here — please try again.",
  load_failed: "We couldn't open this CV. Please try again in a little while.",
  delete_failed: "We couldn't delete this CV. Please try again.",
  not_found: "We couldn't find that CV. It may have been deleted.",
  service_unavailable: "Saving is temporarily unavailable. Please try again in a little while.",
};

/** Confirmation shown after a successful save. */
export const cvSaveSuccessMessage = "Your CV is saved.";
