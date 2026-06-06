/**
 * Centralized S-07 (PDF export) user-facing copy — zod-free, no React.
 *
 * Single home for every string the export action renders, so S-09 (interface
 * localization) can wrap one module per locale instead of combing JSX. English
 * values only for now; the per-CV output language (which drives the PDF *content*)
 * is unrelated to this UI chrome. Mirrors the role of `cv-editor-copy.ts` and
 * `cv-library-copy.ts`. Error *messages* are not duplicated here — they come from
 * `generationErrorMessages` (`export_failed`, `service_unavailable`) in
 * `cv-draft-messages.ts`.
 */

export const cvExportCopy = {
  /** Export action button + progress/announcement copy. */
  action: {
    export: "Export PDF",
    exporting: "Preparing PDF…",
    /** Announced via aria-live once the download is triggered. */
    exported: "Your PDF download has started.",
  },
} as const;
