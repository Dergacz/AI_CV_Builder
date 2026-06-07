/**
 * Centralized S-06 (saved CV library) user-facing copy — zod-free, no React, no
 * Supabase. Safe to import from both client islands and server code.
 *
 * Single home for every string the save bar, dashboard library, and delete dialog
 * render. S-09 (interface localization) turned the former English singleton into a
 * locale-indexed catalog: `cvLibraryCopyByLocale[locale]` / `getCvLibraryCopy(locale)`.
 *
 * Boundary note: `defaultCvTitle()` is intentionally NOT locale-aware. A saved CV
 * title is durable user data, so it must not shift when the interface language changes.
 * It derives from the user's own answers plus an ISO date, with a neutral "CV" fallback.
 */

import type { UiLocale } from "@/lib/i18n/locales";
import type { CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

export interface CvLibraryCopy {
  dashboard: {
    title: string;
    description: string;
    emptyTitle: string;
    emptyBody: string;
    loadErrorTitle: string;
    loadErrorBody: string;
    startCta: string;
  };
  saveBar: {
    titleLabel: string;
    titlePlaceholder: string;
    save: string;
    saving: string;
    saved: string;
  };
  card: {
    open: string;
    delete: string;
    updatedPrefix: string;
  };
  delete: {
    confirmTitle: string;
    confirmBody: string;
    confirm: string;
    cancel: string;
  };
}

export const cvLibraryCopyByLocale = {
  en: {
    dashboard: {
      title: "Your saved CVs",
      description: "Open a saved CV to keep editing, or start a new one.",
      emptyTitle: "No saved CVs yet",
      emptyBody: "When you save a generated CV, it will appear here so you can reopen it later.",
      loadErrorTitle: "Saved CVs could not be loaded",
      loadErrorBody: "Your CVs are still safe. Refresh the page or try again in a little while.",
      startCta: "Start a new CV",
    },
    saveBar: {
      titleLabel: "CV title",
      titlePlaceholder: "Give this CV a name",
      save: "Save",
      saving: "Saving…",
      saved: "Saved",
    },
    card: {
      open: "Open",
      delete: "Delete",
      updatedPrefix: "Updated",
    },
    delete: {
      confirmTitle: "Delete this CV?",
      confirmBody: "This permanently removes the saved CV. This can't be undone.",
      confirm: "Delete CV",
      cancel: "Keep CV",
    },
  },
  pl: {
    dashboard: {
      title: "Twoje zapisane CV",
      description: "Otwórz zapisane CV, aby je dalej edytować, albo rozpocznij nowe.",
      emptyTitle: "Brak zapisanych CV",
      emptyBody: "Gdy zapiszesz wygenerowane CV, pojawi się tutaj, abyś mógł je później otworzyć.",
      loadErrorTitle: "Nie udało się wczytać zapisanych CV",
      loadErrorBody: "Twoje CV nadal są bezpieczne. Odśwież stronę albo spróbuj ponownie za chwilę.",
      startCta: "Rozpocznij nowe CV",
    },
    saveBar: {
      titleLabel: "Tytuł CV",
      titlePlaceholder: "Nadaj temu CV nazwę",
      save: "Zapisz",
      saving: "Zapisywanie…",
      saved: "Zapisano",
    },
    card: {
      open: "Otwórz",
      delete: "Usuń",
      updatedPrefix: "Zaktualizowano",
    },
    delete: {
      confirmTitle: "Usunąć to CV?",
      confirmBody: "To trwale usuwa zapisane CV. Tej operacji nie można cofnąć.",
      confirm: "Usuń CV",
      cancel: "Zachowaj CV",
    },
  },
  ru: {
    dashboard: {
      title: "Ваши сохранённые CV",
      description: "Откройте сохранённое CV, чтобы продолжить редактирование, или начните новое.",
      emptyTitle: "Пока нет сохранённых CV",
      emptyBody: "Когда вы сохраните сгенерированное CV, оно появится здесь, чтобы вы могли открыть его позже.",
      loadErrorTitle: "Не удалось загрузить сохранённые CV",
      loadErrorBody: "Ваши CV всё ещё в безопасности. Обновите страницу или попробуйте чуть позже.",
      startCta: "Начать новое CV",
    },
    saveBar: {
      titleLabel: "Название CV",
      titlePlaceholder: "Дайте этому CV название",
      save: "Сохранить",
      saving: "Сохранение…",
      saved: "Сохранено",
    },
    card: {
      open: "Открыть",
      delete: "Удалить",
      updatedPrefix: "Обновлено",
    },
    delete: {
      confirmTitle: "Удалить это CV?",
      confirmBody: "Это безвозвратно удалит сохранённое CV. Отменить нельзя.",
      confirm: "Удалить CV",
      cancel: "Оставить CV",
    },
  },
} satisfies Record<UiLocale, CvLibraryCopy>;

export function getCvLibraryCopy(locale: UiLocale): CvLibraryCopy {
  return cvLibraryCopyByLocale[locale];
}

/** Max characters of the role portion of a default title before truncation. */
const MAX_TITLE_ROLE = 60;

/** YYYY-MM-DD from a Date (UTC), used as the date portion of a default title. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Default title for a newly-saved CV: `"{role} — {date}"`, truncating a long role
 * and falling back to the person's name (then a bare label) when no role is given.
 * Pure and deterministic given `date`, so it is unit-testable and reused server-side.
 *
 * Intentionally interface-locale-independent: a saved title is durable data and must
 * not change when the UI language changes (S-09 CV-language boundary). The literal
 * "CV" suffix is a neutral fallback, not interface copy.
 */
export function defaultCvTitle(answers: CvQuestionnaireAnswers, date: Date): string {
  const datePart = isoDate(date);
  const role = answers.targetRoleOrGoal.trim();
  if (role) {
    const truncated = role.length > MAX_TITLE_ROLE ? `${role.slice(0, MAX_TITLE_ROLE).trimEnd()}…` : role;
    return `${truncated} — ${datePart}`;
  }
  const name = answers.fullName.trim();
  if (name) {
    return `${name}'s CV — ${datePart}`;
  }
  return `CV — ${datePart}`;
}
