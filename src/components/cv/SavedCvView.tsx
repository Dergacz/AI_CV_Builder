import { useState } from "react";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import type { CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
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
 */
export default function SavedCvView({
  cvId,
  title,
  draft: initialDraft,
  answers,
}: {
  cvId: string;
  title: string;
  draft: GeneratedCvDraft;
  answers: CvQuestionnaireAnswers;
}) {
  const [draft, setDraft] = useState<GeneratedCvDraft | null>(initialDraft);
  const editor = useCvDraftEditor(setDraft);
  const save = useCvSave({ cvId, title });

  if (!draft) return null;

  return <CvEditor draft={draft} editor={editor} save={save} answers={answers} />;
}
