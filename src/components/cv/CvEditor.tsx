import { useEffect, useRef, useState, type ReactNode } from "react";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import { cvEditorCopy } from "@/lib/cv-editor-copy";
import type { CvDraftEditor } from "@/components/hooks/useCvDraftEditor";
import {
  DraftSection,
  EducationContent,
  ExperienceContent,
  LanguagesContent,
  SkillsContent,
  SummaryContent,
} from "@/components/cv/CvTemplate";
import {
  EducationEditor,
  ExperienceEditor,
  LanguagesEditor,
  SkillsEditor,
  SummaryEditor,
} from "@/components/cv/CvSectionEditors";

/**
 * Editable CV template surface (S-05).
 *
 * Renders the generated draft in the single clean template; each section toggles between the
 * read-only `*Content` renderer (shared with `CvTemplate`/S-07) and its inline editor. Only the
 * actively edited section shows a form — other sections stay read-only and their Edit buttons are
 * disabled while one section is open. Warnings/assumptions remain read-only editorial guidance.
 */
export default function CvEditor({
  draft,
  editor,
  onEditAnswers,
}: {
  draft: GeneratedCvDraft;
  editor: CvDraftEditor;
  onEditAnswers: () => void;
}) {
  const { sections, assumptions, warnings } = draft;
  const canEdit = editor.openSection === null;
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Guard the regenerate path only after a committed edit. Opening a section without saving
  // can still be cancelled locally, so it should not trigger the discard-edits prompt.
  const hasWorkToLose = editor.hasEdits;
  function requestEditAnswers() {
    if (hasWorkToLose) {
      setConfirmOpen(true);
    } else {
      onEditAnswers();
    }
  }

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      aria-label="Generated CV draft"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">{cvEditorCopy.preview.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{cvEditorCopy.preview.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{cvEditorCopy.preview.description}</p>
        </div>
        <button
          type="button"
          onClick={requestEditAnswers}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none"
        >
          {cvEditorCopy.preview.editAnswers}
        </button>
      </div>

      {warnings.length > 0 && (
        <section className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4" aria-label="Draft warnings">
          <h3 className="text-sm font-semibold text-amber-950">{cvEditorCopy.preview.warningsTitle}</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>- {warning.message}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 space-y-6">
        <EditableSection
          title={cvEditorCopy.sections.summary}
          isOpen={editor.openSection === "summary"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("summary");
          }}
          read={<SummaryContent summary={sections.summary} />}
          edit={
            <SummaryEditor
              summary={sections.summary}
              onSave={(value) => {
                editor.commitSection("summary", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={cvEditorCopy.sections.experience}
          isOpen={editor.openSection === "experience"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("experience");
          }}
          read={<ExperienceContent items={sections.experience} />}
          edit={
            <ExperienceEditor
              items={sections.experience}
              onSave={(value) => {
                editor.commitSection("experience", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={cvEditorCopy.sections.education}
          isOpen={editor.openSection === "education"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("education");
          }}
          read={<EducationContent items={sections.education} />}
          edit={
            <EducationEditor
              items={sections.education}
              onSave={(value) => {
                editor.commitSection("education", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={cvEditorCopy.sections.skills}
          isOpen={editor.openSection === "skills"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("skills");
          }}
          read={<SkillsContent groups={sections.skills} />}
          edit={
            <SkillsEditor
              groups={sections.skills}
              onSave={(value) => {
                editor.commitSection("skills", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={cvEditorCopy.sections.languages}
          isOpen={editor.openSection === "languages"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("languages");
          }}
          read={<LanguagesContent languages={sections.languages} />}
          edit={
            <LanguagesEditor
              languages={sections.languages}
              onSave={(value) => {
                editor.commitSection("languages", value);
              }}
              onCancel={editor.close}
            />
          }
        />
      </div>

      {assumptions.length > 0 && (
        <section className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4" aria-label="Draft assumptions">
          <h3 className="text-sm font-semibold text-slate-900">{cvEditorCopy.preview.assumptionsTitle}</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
            {assumptions.map((assumption, index) => (
              <li key={`${assumption.field}-${index}`}>- {assumption.reason}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={requestEditAnswers}
          className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline"
        >
          {cvEditorCopy.preview.regenerateLink}
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDiscardDialog
          onConfirm={() => {
            setConfirmOpen(false);
            editor.reset();
            onEditAnswers();
          }}
          onCancel={() => {
            setConfirmOpen(false);
          }}
        />
      )}
    </section>
  );
}

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}

function ConfirmDiscardDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstFocusable = dialogRef.current ? getFocusableElements(dialogRef.current)[0] : null;
    firstFocusable?.focus();

    return () => {
      restoreFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
          return;
        }

        if (event.key !== "Tab" || !dialogRef.current) return;

        const focusable = getFocusableElements(dialogRef.current);
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      role="presentation"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cv-discard-title"
        aria-describedby="cv-discard-body"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 id="cv-discard-title" className="text-lg font-semibold text-slate-950">
          {cvEditorCopy.regenerate.confirmTitle}
        </h2>
        <p id="cv-discard-body" className="mt-2 text-sm leading-6 text-slate-600">
          {cvEditorCopy.regenerate.confirmBody}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none"
          >
            {cvEditorCopy.regenerate.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:ring-3 focus-visible:ring-red-700/30 focus-visible:outline-none"
          >
            {cvEditorCopy.regenerate.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditableSection({
  title,
  isOpen,
  canEdit,
  onEdit,
  read,
  edit,
}: {
  title: string;
  isOpen: boolean;
  canEdit: boolean;
  onEdit: () => void;
  read: ReactNode;
  edit: ReactNode;
}) {
  if (isOpen) return <>{edit}</>;
  return (
    <DraftSection
      title={title}
      action={
        <button
          type="button"
          onClick={onEdit}
          disabled={!canEdit}
          className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          {cvEditorCopy.actions.edit}
        </button>
      }
    >
      {read}
    </DraftSection>
  );
}
