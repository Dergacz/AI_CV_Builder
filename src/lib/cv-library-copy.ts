/**
 * Centralized S-06 (saved CV library) user-facing copy — zod-free, no React, no
 * Supabase. Safe to import from both client islands and server code.
 *
 * Single home for every string the save bar, dashboard library, and delete dialog
 * render, so S-09 (interface localization) can wrap one module per locale. English
 * values only for now; the per-CV output language is unrelated to this UI copy.
 * Mirrors the role of `cv-editor-copy.ts`.
 */

import type { CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

export const cvLibraryCopy = {
  /** Dashboard "Saved CVs" library section. */
  dashboard: {
    title: "Your saved CVs",
    description: "Open a saved CV to keep editing, or start a new one.",
    emptyTitle: "No saved CVs yet",
    emptyBody: "When you save a generated CV, it will appear here so you can reopen it later.",
    loadErrorTitle: "Saved CVs could not be loaded",
    loadErrorBody: "Your CVs are still safe. Refresh the page or try again in a little while.",
    startCta: "Start a new CV",
  },

  /** Save bar shown in the editor (creation and reopen flows). */
  saveBar: {
    titleLabel: "CV title",
    titlePlaceholder: "Give this CV a name",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
  },

  /** Library card affordances. */
  card: {
    open: "Open",
    delete: "Delete",
    updatedPrefix: "Updated",
  },

  /** Confirm-before-delete dialog (reuses the shared confirm dialog). */
  delete: {
    confirmTitle: "Delete this CV?",
    confirmBody: "This permanently removes the saved CV. This can't be undone.",
    confirm: "Delete CV",
    cancel: "Keep CV",
  },
} as const;

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
