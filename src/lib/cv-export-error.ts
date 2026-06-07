/**
 * Classifies a caught PDF-export error into the correct user-facing bucket — pure,
 * zod-free, client-safe.
 *
 * Font/asset *fetch* failures are a temporary dependency problem → `service_unavailable`
 * (retry later). Everything else (render/layout/serialization) → `export_failed`
 * (the edits are safe, retry now). The caller looks up the message via
 * `generationErrorMessages[bucket]` in `cv-draft-messages.ts`.
 */

import type { GenerationErrorBucket } from "@/lib/cv-draft-messages";

export type ExportErrorBucket = Extract<GenerationErrorBucket, "export_failed" | "service_unavailable">;

/** Signals that the failure was a font/asset fetch rather than a render error. */
const FETCH_FAILURE =
  /\b(failed to fetch|networkerror|network error|load.*font|font.*load|err_|\.ttf)\b|fetch|network|timeout/i;

/** Pull a comparable string out of an unknown thrown value. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  return "";
}

/**
 * Map an export error to `service_unavailable` (font/asset fetch failure) or
 * `export_failed` (any other render-time failure, the safe default).
 */
export function classifyExportError(error: unknown): ExportErrorBucket {
  return FETCH_FAILURE.test(messageOf(error)) ? "service_unavailable" : "export_failed";
}
