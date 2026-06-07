import { useState } from "react";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import type { CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import type { UiLocale } from "@/lib/i18n/locales";
import CvEditor from "@/components/cv/CvEditor";
import { useCvDraftEditor } from "@/components/hooks/useCvDraftEditor";
import { useCvSave } from "@/components/hooks/useCvSave";

/**
 * Reopen surface for a saved CV (S-06).
 *
 * Hydrates from server-loaded props and reuses the creation-flow editor, but pre-seeds
 * `useCvSave` with the existing `cvId`/`title` so the first save is already an UPDATE.
 * `onEditAnswers` is intentionally omitted, which hides the edit-answers/regenerate path
 * (regenerating would discard edits — out of scope for a reopened CV).
 *
 * S-09: the interface `locale` flows into the editor and save hook for localized UI chrome.
 */
export default function SavedCvView({
  cvId,
  title,
  draft: initialDraft,
  answers,
  locale,
}: {
  cvId: string;
  title: string;
  draft: GeneratedCvDraft;
  answers: CvQuestionnaireAnswers;
  locale: UiLocale;
}) {
  const [draft, setDraft] = useState<GeneratedCvDraft | null>(initialDraft);
  const editor = useCvDraftEditor(setDraft);
  const save = useCvSave({ cvId, title, locale });

  if (!draft) return null;

  return <CvEditor draft={draft} editor={editor} save={save} answers={answers} locale={locale} />;
}
