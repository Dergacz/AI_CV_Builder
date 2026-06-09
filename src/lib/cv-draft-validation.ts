/**
 * Client-side validation guards for editing a generated CV draft — zod-free on purpose.
 *
 * These mirror the *required-field* constraints in `cv-draft.ts` (`summary.body`,
 * `skills[].label` + `skills[].items.min(1)`, `languages[].name`) so the editor island
 * can block an invalid Save without importing zod into the browser bundle. The zod schema
 * stays the server-side source of truth; a unit test asserts the two never drift.
 *
 * Only hard schema requirements are enforced here — optional fields never block a Save.
 */
import type { SummarySection, SkillGroup, LanguageItem } from "@/lib/cv-draft";
import { cvEditorCopy } from "@/lib/cv-editor-copy";

export interface SummaryErrors {
  body?: string;
}

export interface SkillGroupErrors {
  label?: string;
  items?: string;
}

export interface LanguageErrors {
  name?: string;
}

const hasText = (value: string | undefined): boolean => Boolean(value && value.trim().length > 0);

/** Summary is valid when its required `body` has non-whitespace content. */
export function validateSummary(summary: SummarySection): SummaryErrors {
  const errors: SummaryErrors = {};
  if (!hasText(summary.body)) {
    errors.body = cvEditorCopy.validation.summaryBodyRequired;
  }
  return errors;
}

/** A skill group is valid with a non-empty label and at least one non-empty item. */
export function validateSkillGroup(group: SkillGroup): SkillGroupErrors {
  const errors: SkillGroupErrors = {};
  if (!hasText(group.label)) {
    errors.label = cvEditorCopy.validation.skillGroupLabelRequired;
  }
  if (!group.items.some(hasText)) {
    errors.items = cvEditorCopy.validation.skillGroupItemsRequired;
  }
  return errors;
}

/** A language is valid when its required `name` has non-whitespace content. */
export function validateLanguage(language: LanguageItem): LanguageErrors {
  const errors: LanguageErrors = {};
  if (!hasText(language.name)) {
    errors.name = cvEditorCopy.validation.languageNameRequired;
  }
  return errors;
}

/**
 * True when an error map has no keys set. Accepts any error object (the typed
 * `*Errors` interfaces have no string index signature, so a bare
 * `Record<string, string | undefined>` would reject them).
 */
export function isClean(errors: object): boolean {
  return Object.values(errors).every((value) => value === undefined);
}
