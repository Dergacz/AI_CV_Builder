import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import type { GeneratedCvDraft } from "@/lib/cv-draft";

export type CvSectionKey = "summary" | "experience" | "education" | "skills" | "languages";

export interface CvDraftEditor {
  /** The section currently in edit mode, or null when the whole template is read-only. */
  openSection: CvSectionKey | null;
  /** True once any section has been committed — drives the Phase 3 regenerate guard. */
  hasEdits: boolean;
  /** Open a section for editing (closes any other open section). */
  open: (section: CvSectionKey) => void;
  /** Close the open section without committing (Cancel). */
  close: () => void;
  /** Clear all editor-local state after discarding edits or accepting a fresh draft. */
  reset: () => void;
  /** Commit a validated section back into the draft immutably and close the editor. */
  commitSection: <K extends CvSectionKey>(key: K, value: GeneratedCvDraft["sections"][K]) => void;
}

/**
 * Owns the per-section edit state for the CV template editor.
 *
 * The draft itself stays in the questionnaire island's state; this hook only tracks which
 * section is open and applies committed section edits immutably (preserving the
 * `GeneratedCvDraft` shape). Add/remove of array items happens on each editor's local
 * working copy and reaches the draft only through `commitSection` on Save.
 */
export function useCvDraftEditor(setDraft: Dispatch<SetStateAction<GeneratedCvDraft | null>>): CvDraftEditor {
  const [openSection, setOpenSection] = useState<CvSectionKey | null>(null);
  const [hasEdits, setHasEdits] = useState(false);

  const open = useCallback((section: CvSectionKey) => {
    setOpenSection(section);
  }, []);

  const close = useCallback(() => {
    setOpenSection(null);
  }, []);

  const reset = useCallback(() => {
    setOpenSection(null);
    setHasEdits(false);
  }, []);

  const commitSection = useCallback<CvDraftEditor["commitSection"]>(
    (key, value) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              sections: { ...current.sections, [key]: value },
            }
          : current,
      );
      setHasEdits(true);
      setOpenSection(null);
    },
    [setDraft],
  );

  return { openSection, hasEdits, open, close, reset, commitSection };
}
