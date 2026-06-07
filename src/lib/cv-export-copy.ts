/**
 * Centralized S-07 (PDF export) user-facing copy — zod-free, no React.
 *
 * Single home for every string the export action renders, so S-09 (interface
 * localization) can wrap one module per locale instead of combing JSX. English
 * values only for now; the per-CV output language (which drives the PDF *content*)
 * is unrelated to this UI chrome. Mirrors the role of `cv-editor-copy.ts` and
 * `cv-library-copy.ts`.
 */

import type { ExportErrorBucket } from "@/lib/cv-export-error";

export const cvExportCopy = {
  /** Export action button + progress/announcement copy. */
  action: {
    export: "Export PDF",
    exporting: "Preparing PDF…",
    /** Announced via aria-live once the download is triggered. */
    exported: "Your PDF download has started.",
  },

  /**
   * Export-specific failure copy. Mirrors the F-01 buckets but worded for the export
   * flow (the shared `generationErrorMessages.service_unavailable` says "generation",
   * which reads wrong when the failure is a font/asset fetch during PDF export).
   */
  errors: {
    export_failed: "We couldn't export your CV to PDF. Your edits are safe — please try again.",
    service_unavailable: "PDF export is temporarily unavailable. Please try again in a little while.",
  } satisfies Record<ExportErrorBucket, string>,
} as const;
