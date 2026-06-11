import { useState, type ReactNode } from "react";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import type { CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import { getCvEditorCopy } from "@/lib/cv-editor-copy";
import { getCvExportCopy } from "@/lib/cv-export-copy";
import { getCvLibraryCopy } from "@/lib/cv-library-copy";
import type { UiLocale } from "@/lib/i18n/locales";
import type { CvDraftEditor, CvSectionKey } from "@/components/hooks/useCvDraftEditor";
import { useCvExport } from "@/components/hooks/useCvExport";
import type { CvSaveController } from "@/components/hooks/useCvSave";
import ConfirmDialog from "@/components/cv/ConfirmDialog";
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
 *
 * S-09: all editor UI chrome follows the interface `locale`. The export PDF, however, selects its
 * section headings by the CV output language (`answers.outputLanguage`), so interface language
 * never changes the exported document's content language.
 */
export default function CvEditor({
  draft,
  editor,
  save,
  answers,
  locale,
  onEditAnswers,
}: {
  draft: GeneratedCvDraft;
  editor: CvDraftEditor;
  save: CvSaveController;
  answers: CvQuestionnaireAnswers;
  locale: UiLocale;
  /** Omitted on the reopen flow (Phase 5), which hides the edit-answers/regenerate path. */
  onEditAnswers?: () => void;
}) {
  const copy = getCvEditorCopy(locale);
  const libraryCopy = getCvLibraryCopy(locale);
  const exportCopy = getCvExportCopy(locale);
  const { sections, assumptions, warnings } = draft;
  const canEdit = editor.openSection === null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const exporter = useCvExport(locale);
  const isExporting = exporter.status === "exporting";

  // Guard the regenerate path only after a committed edit. Opening a section without saving
  // can still be cancelled locally, so it should not trigger the discard-edits prompt.
  const hasWorkToLose = editor.hasEdits;
  function requestEditAnswers() {
    if (!onEditAnswers) return;
    if (hasWorkToLose) {
      setConfirmOpen(true);
    } else {
      onEditAnswers();
    }
  }

  function commitSection<K extends CvSectionKey>(key: K, value: GeneratedCvDraft["sections"][K]) {
    editor.commitSection(key, value);
    save.markUnsaved();
  }

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      aria-label={copy.preview.draftAriaLabel}
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">{copy.preview.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{copy.preview.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{copy.preview.description}</p>
        </div>
        {onEditAnswers && (
          <button
            type="button"
            onClick={requestEditAnswers}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none"
          >
            {copy.preview.editAnswers}
          </button>
        )}
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <label htmlFor="cv-title" className="text-sm font-medium text-slate-700">
              {libraryCopy.saveBar.titleLabel}
            </label>
            <input
              id="cv-title"
              type="text"
              value={save.title}
              maxLength={200}
              onChange={(event) => {
                save.setTitle(event.target.value);
              }}
              placeholder={libraryCopy.saveBar.titlePlaceholder}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-700/20 focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {save.status === "saved" && (
              <span role="status" className="w-full text-sm font-medium text-emerald-700 sm:w-auto">
                {libraryCopy.saveBar.saved}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                void exporter.export(draft, {
                  title: save.title,
                  fullName: answers.fullName,
                  outputLanguage: answers.outputLanguage,
                });
              }}
              disabled={isExporting || !canEdit}
              aria-busy={isExporting}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:flex-none"
            >
              {isExporting && <Spinner />}
              {isExporting ? exportCopy.action.exporting : exportCopy.action.export}
            </button>
            <button
              type="button"
              onClick={() => {
                void save.save(draft, answers);
              }}
              disabled={save.status === "saving" || !canEdit}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-emerald-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 sm:flex-none"
            >
              {save.status === "saving" ? libraryCopy.saveBar.saving : libraryCopy.saveBar.save}
            </button>
          </div>
        </div>
        {isExporting && (
          <p role="status" aria-live="polite" className="mt-3 text-sm font-medium text-slate-600">
            {exportCopy.action.exporting}
          </p>
        )}
        {exporter.status === "done" && (
          <p role="status" aria-live="polite" className="mt-3 text-sm font-medium text-emerald-700">
            {exportCopy.action.exported}
          </p>
        )}
        {save.status === "error" && save.error && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900"
          >
            {save.error}
          </div>
        )}
        {exporter.status === "error" && exporter.error && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900"
          >
            {exporter.error}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <section
          className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4"
          aria-label={copy.preview.warningsAriaLabel}
        >
          <h3 className="text-sm font-semibold text-amber-950">{copy.preview.warningsTitle}</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>- {warning.message}</li>
            ))}
          </ul>
        </section>
      )}

      {answers.fullName.trim() && (
        <header className="mt-6 border-b-2 border-slate-900 pb-3">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950">{answers.fullName}</h3>
        </header>
      )}

      <div className="mt-6 space-y-6">
        <EditableSection
          title={copy.sections.summary}
          editLabel={copy.actions.edit}
          isOpen={editor.openSection === "summary"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("summary");
          }}
          read={<SummaryContent summary={sections.summary} />}
          edit={
            <SummaryEditor
              summary={sections.summary}
              locale={locale}
              onSave={(value) => {
                commitSection("summary", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={copy.sections.experience}
          editLabel={copy.actions.edit}
          isOpen={editor.openSection === "experience"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("experience");
          }}
          read={<ExperienceContent items={sections.experience} locale={locale} />}
          edit={
            <ExperienceEditor
              items={sections.experience}
              locale={locale}
              onSave={(value) => {
                commitSection("experience", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={copy.sections.education}
          editLabel={copy.actions.edit}
          isOpen={editor.openSection === "education"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("education");
          }}
          read={<EducationContent items={sections.education} locale={locale} />}
          edit={
            <EducationEditor
              items={sections.education}
              locale={locale}
              onSave={(value) => {
                commitSection("education", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={copy.sections.skills}
          editLabel={copy.actions.edit}
          isOpen={editor.openSection === "skills"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("skills");
          }}
          read={<SkillsContent groups={sections.skills} locale={locale} />}
          edit={
            <SkillsEditor
              groups={sections.skills}
              locale={locale}
              onSave={(value) => {
                commitSection("skills", value);
              }}
              onCancel={editor.close}
            />
          }
        />
        <EditableSection
          title={copy.sections.languages}
          editLabel={copy.actions.edit}
          isOpen={editor.openSection === "languages"}
          canEdit={canEdit}
          onEdit={() => {
            editor.open("languages");
          }}
          read={<LanguagesContent languages={sections.languages} locale={locale} />}
          edit={
            <LanguagesEditor
              languages={sections.languages}
              locale={locale}
              onSave={(value) => {
                commitSection("languages", value);
              }}
              onCancel={editor.close}
            />
          }
        />
      </div>

      {assumptions.length > 0 && (
        <section
          className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4"
          aria-label={copy.preview.assumptionsAriaLabel}
        >
          <h3 className="text-sm font-semibold text-slate-900">{copy.preview.assumptionsTitle}</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
            {assumptions.map((assumption, index) => (
              <li key={`${assumption.field}-${index}`}>- {assumption.reason}</li>
            ))}
          </ul>
        </section>
      )}

      {onEditAnswers && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={requestEditAnswers}
            className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline"
          >
            {copy.preview.regenerateLink}
          </button>
        </div>
      )}

      {confirmOpen && (
        <ConfirmDialog
          title={copy.regenerate.confirmTitle}
          body={copy.regenerate.confirmBody}
          confirmLabel={copy.regenerate.confirm}
          cancelLabel={copy.regenerate.cancel}
          onConfirm={() => {
            setConfirmOpen(false);
            editor.reset();
            onEditAnswers?.();
          }}
          onCancel={() => {
            setConfirmOpen(false);
          }}
        />
      )}
    </section>
  );
}

function EditableSection({
  title,
  editLabel,
  isOpen,
  canEdit,
  onEdit,
  read,
  edit,
}: {
  title: string;
  editLabel: string;
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
          {editLabel}
        </button>
      }
    >
      {read}
    </DraftSection>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700"
      aria-hidden="true"
    />
  );
}
