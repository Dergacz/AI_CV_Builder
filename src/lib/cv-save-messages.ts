/**
 * User-facing saved-CV error copy — zod-free on purpose.
 *
 * Lives apart from server modules so client islands can import the *values* without
 * pulling zod or Supabase into the browser bundle. Mirrors `cv-draft-messages.ts`.
 * Messages never leak provider/internal/SQL detail (F-02 diagnostics rules).
 *
 * S-09: the server keeps returning the English `message` for response compatibility,
 * but also returns a stable `error` bucket. Client islands localize by mapping that
 * bucket through `getCvSaveErrorMessages(locale)`.
 */

import type { UiLocale } from "@/lib/i18n/locales";

/** Stable failure buckets for save / list / reopen / delete. */
export type CvSaveErrorBucket = "save_failed" | "load_failed" | "delete_failed" | "not_found" | "service_unavailable";

/** English copy for each bucket. Server-facing: used for the response `message` field. */
export const cvSaveErrorMessages: Record<CvSaveErrorBucket, string> = {
  save_failed: "We couldn't save your CV. Your edits are still here — please try again.",
  load_failed: "We couldn't open this CV. Please try again in a little while.",
  delete_failed: "We couldn't delete this CV. Please try again.",
  not_found: "We couldn't find that CV. It may have been deleted.",
  service_unavailable: "Saving is temporarily unavailable. Please try again in a little while.",
};

/** Confirmation shown after a successful save (English; server-facing default). */
export const cvSaveSuccessMessage = "Your CV is saved.";

/** Locale-indexed saved-CV error copy for client-side display by stable bucket. */
export const cvSaveErrorMessagesByLocale = {
  en: cvSaveErrorMessages,
  pl: {
    save_failed: "Nie udało się zapisać CV. Twoje zmiany są nadal tutaj — spróbuj ponownie.",
    load_failed: "Nie udało się otworzyć tego CV. Spróbuj ponownie za chwilę.",
    delete_failed: "Nie udało się usunąć tego CV. Spróbuj ponownie.",
    not_found: "Nie znaleziono tego CV. Mogło zostać usunięte.",
    service_unavailable: "Zapisywanie jest chwilowo niedostępne. Spróbuj ponownie za chwilę.",
  },
  ru: {
    save_failed: "Не удалось сохранить CV. Ваши изменения на месте — попробуйте снова.",
    load_failed: "Не удалось открыть это CV. Попробуйте чуть позже.",
    delete_failed: "Не удалось удалить это CV. Попробуйте снова.",
    not_found: "Не удалось найти это CV. Возможно, оно было удалено.",
    service_unavailable: "Сохранение временно недоступно. Попробуйте чуть позже.",
  },
} satisfies Record<UiLocale, Record<CvSaveErrorBucket, string>>;

export function getCvSaveErrorMessages(locale: UiLocale): Record<CvSaveErrorBucket, string> {
  return cvSaveErrorMessagesByLocale[locale];
}

/** Locale-indexed successful-save confirmation. */
export const cvSaveSuccessMessageByLocale = {
  en: cvSaveSuccessMessage,
  pl: "Twoje CV zostało zapisane.",
  ru: "Ваше CV сохранено.",
} satisfies Record<UiLocale, string>;
