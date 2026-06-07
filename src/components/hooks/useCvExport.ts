import { createElement, useCallback, useState } from "react";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import { generationErrorMessages } from "@/lib/cv-draft-messages";
import { buildCvPdfFilename } from "@/lib/cv-export-filename";
import { classifyExportError } from "@/lib/cv-export-error";

export type CvExportStatus = "idle" | "exporting" | "done" | "error";

export interface CvExportController {
  status: CvExportStatus;
  error: string | null;
  /** Build a PDF from the current draft and trigger a download. Maps failures to a user-facing bucket. */
  export: (draft: GeneratedCvDraft, meta: { title?: string; fullName?: string }) => Promise<void>;
}

/** Create an object URL for the blob, click a transient anchor, then revoke. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Owns the PDF export lifecycle for the editor (S-07): `idle → exporting → done/error`.
 *
 * The heavy `@react-pdf/renderer` and the PDF document module are dynamically imported on
 * the click path only, so they never enter the SSR/Worker bundle and cost nothing until a
 * user exports. Font-fetch failures map to `service_unavailable`, render failures to
 * `export_failed`; the edited CV stays on screen so the user can retry.
 */
export function useCvExport(): CvExportController {
  const [status, setStatus] = useState<CvExportStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const exportPdf = useCallback<CvExportController["export"]>(async (draft, meta) => {
    setStatus("exporting");
    setError(null);
    try {
      const [{ pdf }, { default: CvPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/cv/CvPdfDocument"),
      ]);
      const blob = await pdf(createElement(CvPdfDocument, { draft, fullName: meta.fullName })).toBlob();
      triggerDownload(blob, buildCvPdfFilename(meta));
      setStatus("done");
    } catch (caught) {
      setError(generationErrorMessages[classifyExportError(caught)]);
      setStatus("error");
    }
  }, []);

  return { status, error, export: exportPdf };
}
