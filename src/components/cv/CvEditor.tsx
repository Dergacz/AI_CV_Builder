import { type ReactNode } from "react";

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
          onClick={onEditAnswers}
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
          onClick={onEditAnswers}
          className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline"
        >
          {cvEditorCopy.preview.regenerateLink}
        </button>
      </div>
    </section>
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
