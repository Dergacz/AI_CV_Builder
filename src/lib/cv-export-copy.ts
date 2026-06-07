/**
 * Centralized S-07 (PDF export) user-facing copy — zod-free, no React.
 *
 * Single home for every string the export action renders. S-09 (interface localization)
 * turned the former English singleton into a locale-indexed catalog:
 * `cvExportCopyByLocale[locale]` / `getCvExportCopy(locale)`.
 *
 * Boundary note: this copy is export *UI chrome* (button/progress/errors) and follows
 * the interface locale. The PDF *content* language is governed separately by the CV
 * output language (see `CvPdfDocument`), so changing the interface language never
 * changes the exported document's content.
 */

import type { UiLocale } from "@/lib/i18n/locales";
import type { ExportErrorBucket } from "@/lib/cv-export-error";

export interface CvExportCopy {
  action: {
    export: string;
    exporting: string;
    /** Announced via aria-live once the download is triggered. */
    exported: string;
  };
  /**
   * Export-specific failure copy. Mirrors the F-01 buckets but worded for the export
   * flow (the shared generation copy says "generation", which reads wrong when the
   * failure is a font/asset fetch during PDF export).
   */
  errors: Record<ExportErrorBucket, string>;
}

export const cvExportCopyByLocale = {
  en: {
    action: {
      export: "Export PDF",
      exporting: "Preparing PDF…",
      exported: "Your PDF download has started.",
    },
    errors: {
      export_failed: "We couldn't export your CV to PDF. Your edits are safe — please try again.",
      service_unavailable: "PDF export is temporarily unavailable. Please try again in a little while.",
    },
  },
  pl: {
    action: {
      export: "Eksportuj PDF",
      exporting: "Przygotowywanie PDF…",
      exported: "Pobieranie PDF zostało rozpoczęte.",
    },
    errors: {
      export_failed: "Nie udało się wyeksportować CV do PDF. Twoje zmiany są bezpieczne — spróbuj ponownie.",
      service_unavailable: "Eksport PDF jest chwilowo niedostępny. Spróbuj ponownie za chwilę.",
    },
  },
  ru: {
    action: {
      export: "Экспорт в PDF",
      exporting: "Подготовка PDF…",
      exported: "Загрузка PDF началась.",
    },
    errors: {
      export_failed: "Не удалось экспортировать CV в PDF. Ваши изменения сохранены — попробуйте снова.",
      service_unavailable: "Экспорт PDF временно недоступен. Попробуйте чуть позже.",
    },
  },
} satisfies Record<UiLocale, CvExportCopy>;

export function getCvExportCopy(locale: UiLocale): CvExportCopy {
  return cvExportCopyByLocale[locale];
}
