/**
 * User-facing generation error copy — zod-free on purpose.
 *
 * Lives apart from `cv-draft.ts` (which imports zod) so the client island can
 * import the *values* here without pulling zod into the browser bundle.
 * `cv-draft.ts` re-exports the English `generationErrorMessages` so server code keeps
 * a single import surface (and stays interface-locale-free).
 *
 * S-09: the server keeps returning the English `message` for response compatibility,
 * but also returns a stable `error` bucket. Client islands localize by mapping that
 * bucket through `getGenerationErrorMessages(locale)`.
 */

import type { UiLocale } from "@/lib/i18n/locales";

/**
 * User-facing failure buckets from the F-01 contract. S-04 exercises
 * `generation_failed` and `service_unavailable`; `export_failed` is owned by S-07
 * but kept here so the bucket set stays complete.
 */
export type GenerationErrorBucket = "generation_failed" | "export_failed" | "service_unavailable";

/**
 * English copy for each bucket (no provider/internal detail leaks). Server-facing:
 * used for the response `message` field. Kept as the `en` branch of the locale catalog.
 */
export const generationErrorMessages: Record<GenerationErrorBucket, string> = {
  generation_failed: "We couldn't build your CV draft from these answers. Please try again.",
  export_failed: "We couldn't export your CV. Your edits are safe — please try again.",
  service_unavailable: "CV generation is temporarily unavailable. Please try again in a little while.",
};

/** Locale-indexed generation error copy for client-side display by stable bucket. */
export const generationErrorMessagesByLocale = {
  en: generationErrorMessages,
  pl: {
    generation_failed: "Nie udało się utworzyć szkicu CV na podstawie tych odpowiedzi. Spróbuj ponownie.",
    export_failed: "Nie udało się wyeksportować CV. Twoje zmiany są bezpieczne — spróbuj ponownie.",
    service_unavailable: "Generowanie CV jest chwilowo niedostępne. Spróbuj ponownie za chwilę.",
  },
  ru: {
    generation_failed: "Не удалось создать черновик CV из этих ответов. Попробуйте снова.",
    export_failed: "Не удалось экспортировать CV. Ваши изменения сохранены — попробуйте снова.",
    service_unavailable: "Генерация CV временно недоступна. Попробуйте чуть позже.",
  },
} satisfies Record<UiLocale, Record<GenerationErrorBucket, string>>;

export function getGenerationErrorMessages(locale: UiLocale): Record<GenerationErrorBucket, string> {
  return generationErrorMessagesByLocale[locale];
}
