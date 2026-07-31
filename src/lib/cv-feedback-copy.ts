/**
 * Post-generation feedback widget copy (S-05 / FR-010) — zod-free, no React.
 *
 * Follows the `cv-editor-copy.ts` pattern: one locale-indexed catalog so both the
 * client island and any server-side render read the same strings. Kept free of zod
 * and Supabase imports so the widget bundle stays small.
 *
 * Privacy note: nothing here is sent to PostHog. The comment the user types under
 * `commentLabel` is persisted only to `public.feedback`; the analytics event carries
 * just the verdict, locale, and generation event id.
 */

import type { UiLocale } from "@/lib/i18n/locales";

export interface CvFeedbackCopy {
  title: string;
  description: string;
  helpful: string;
  notHelpful: string;
  commentLabel: string;
  commentPlaceholder: string;
  submit: string;
  submitting: string;
  thanks: string;
  errorRetry: string;
  /** Composed aria-labels (not visible text). */
  regionAriaLabel: string;
  verdictGroupAriaLabel: string;
}

export const cvFeedbackCopyByLocale = {
  en: {
    title: "Was this draft helpful?",
    description: "Your answer helps us improve generation. We never store your CV content with the feedback.",
    helpful: "Helpful",
    notHelpful: "Not helpful",
    commentLabel: "Tell us more (optional)",
    commentPlaceholder: "What worked well, or what was off?",
    submit: "Send feedback",
    submitting: "Sending…",
    thanks: "Thanks — your feedback was recorded.",
    errorRetry: "We couldn't send your feedback. Please try again.",
    regionAriaLabel: "Draft feedback",
    verdictGroupAriaLabel: "Was this draft helpful?",
  },
  pl: {
    title: "Czy ten szkic był pomocny?",
    description: "Twoja odpowiedź pomaga nam ulepszać generowanie. Nigdy nie zapisujemy treści CV razem z opinią.",
    helpful: "Pomocny",
    notHelpful: "Niepomocny",
    commentLabel: "Napisz więcej (opcjonalnie)",
    commentPlaceholder: "Co zadziałało dobrze, a co nie?",
    submit: "Wyślij opinię",
    submitting: "Wysyłanie…",
    thanks: "Dziękujemy — Twoja opinia została zapisana.",
    errorRetry: "Nie udało się wysłać opinii. Spróbuj ponownie.",
    regionAriaLabel: "Opinia o szkicu",
    verdictGroupAriaLabel: "Czy ten szkic był pomocny?",
  },
  ru: {
    title: "Этот черновик оказался полезным?",
    description: "Ваш ответ помогает улучшать генерацию. Содержимое CV никогда не сохраняется вместе с отзывом.",
    helpful: "Полезно",
    notHelpful: "Не полезно",
    commentLabel: "Расскажите подробнее (необязательно)",
    commentPlaceholder: "Что получилось хорошо, а что нет?",
    submit: "Отправить отзыв",
    submitting: "Отправка…",
    thanks: "Спасибо — ваш отзыв записан.",
    errorRetry: "Не удалось отправить отзыв. Попробуйте снова.",
    regionAriaLabel: "Отзыв о черновике",
    verdictGroupAriaLabel: "Этот черновик оказался полезным?",
  },
} satisfies Record<UiLocale, CvFeedbackCopy>;

export function getCvFeedbackCopy(locale: UiLocale): CvFeedbackCopy {
  return cvFeedbackCopyByLocale[locale];
}
