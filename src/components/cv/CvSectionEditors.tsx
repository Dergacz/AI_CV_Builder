import { useState, type ReactNode } from "react";

import type { EducationItem, ExperienceItem, LanguageItem, SkillGroup, SummarySection } from "@/lib/cv-draft";
import { getCvEditorCopy } from "@/lib/cv-editor-copy";
import type { UiLocale } from "@/lib/i18n/locales";
import {
  isClean,
  validateLanguage,
  validateSkillGroup,
  validateSummary,
  type LanguageErrors,
  type SkillGroupErrors,
  type SummaryErrors,
} from "@/lib/cv-draft-validation";
import { InlineTextInput, TextAreaField, TextField } from "@/components/cv/CvFormFields";
import { cn } from "@/lib/utils";

/**
 * Per-section edit forms for the CV template (S-05).
 *
 * Each editor holds a local working copy of its section, supports add/remove of array items,
 * runs the zod-free validation guards on Save (blocking only on schema-required fields), and
 * commits via `onSave`. Cancel discards the working copy. The draft is never mutated until a
 * validated Save, so the committed `GeneratedCvDraft` always stays schema-valid.
 *
 * S-09: every editor takes the interface `locale` and selects its UI chrome from
 * `getCvEditorCopy(locale)`. The localized labels flow down to the presentational helpers.
 */

const hasText = (value: string | undefined): boolean => Boolean(value && value.trim().length > 0);

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((item, i) => (i === index ? value : item));
}

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

const saveButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-emerald-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600";
const cancelButtonClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none";
const addButtonClass =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 focus-visible:ring-3 focus-visible:ring-emerald-700/20 focus-visible:outline-none";
const removeButtonClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:ring-3 focus-visible:ring-red-500/20 focus-visible:outline-none";

function SectionEditFrame({
  title,
  ariaLabel,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  ariaLabel: string;
  saveLabel: string;
  cancelLabel: string;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={ariaLabel}>
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onSave} className={saveButtonClass}>
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel} className={cancelButtonClass}>
          {cancelLabel}
        </button>
      </div>
    </section>
  );
}

function ItemCard({
  removeAriaLabel,
  removeLabel,
  onRemove,
  children,
}: {
  removeAriaLabel: string;
  removeLabel: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex justify-end">
        <button type="button" onClick={onRemove} className={removeButtonClass} aria-label={removeAriaLabel}>
          {removeLabel}
        </button>
      </div>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  );
}

function StringListField({
  label,
  items,
  itemNoun,
  addLabel,
  removeLabel,
  error,
  onChange,
}: {
  label: string;
  items: string[];
  itemNoun: string;
  addLabel: string;
  removeLabel: string;
  error?: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {items.length > 0 && (
        <div className="mt-2 space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <InlineTextInput
                value={item}
                ariaLabel={`${itemNoun} ${index + 1}`}
                onChange={(value) => {
                  onChange(replaceAt(items, index, value));
                }}
                error={Boolean(error)}
              />
              <button
                type="button"
                onClick={() => {
                  onChange(removeAt(items, index));
                }}
                className={removeButtonClass}
                aria-label={`${removeLabel} ${itemNoun} ${index + 1}`}
              >
                {removeLabel}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          onChange([...items, ""]);
        }}
        className={cn(addButtonClass, "mt-2")}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function SummaryEditor({
  summary,
  locale,
  onSave,
  onCancel,
}: {
  summary: SummarySection;
  locale: UiLocale;
  onSave: (value: SummarySection) => void;
  onCancel: () => void;
}) {
  const copy = getCvEditorCopy(locale);
  const [value, setValue] = useState<SummarySection>(summary);
  const [errors, setErrors] = useState<SummaryErrors>({});

  function handleSave() {
    const found = validateSummary(value);
    setErrors(found);
    if (!isClean(found)) return;
    onSave({ headline: hasText(value.headline) ? value.headline : undefined, body: value.body });
  }

  return (
    <SectionEditFrame
      title={copy.sections.summary}
      ariaLabel={`${copy.actions.edit} ${copy.sections.summary}`}
      saveLabel={copy.actions.save}
      cancelLabel={copy.actions.cancel}
      onSave={handleSave}
      onCancel={onCancel}
    >
      <TextField
        id="cv-summary-headline"
        label={copy.fields.summaryHeadline}
        value={value.headline ?? ""}
        onChange={(headline) => {
          setValue((current) => ({ ...current, headline }));
        }}
      />
      <TextAreaField
        id="cv-summary-body"
        label={copy.fields.summaryBody}
        rows={5}
        value={value.body}
        error={errors.body ? copy.validation.summaryBodyRequired : undefined}
        onChange={(body) => {
          setValue((current) => ({ ...current, body }));
          if (errors.body) setErrors({});
        }}
      />
    </SectionEditFrame>
  );
}

export function ExperienceEditor({
  items,
  locale,
  onSave,
  onCancel,
}: {
  items: ExperienceItem[];
  locale: UiLocale;
  onSave: (value: ExperienceItem[]) => void;
  onCancel: () => void;
}) {
  const copy = getCvEditorCopy(locale);
  const [list, setList] = useState<ExperienceItem[]>(items);

  function update(index: number, patch: Partial<ExperienceItem>) {
    setList((current) => replaceAt(current, index, { ...current[index], ...patch }));
  }

  function handleSave() {
    const cleaned = list.map((item) => ({ ...item, highlights: item.highlights.filter(hasText) }));
    onSave(cleaned);
  }

  return (
    <SectionEditFrame
      title={copy.sections.experience}
      ariaLabel={`${copy.actions.edit} ${copy.sections.experience}`}
      saveLabel={copy.actions.save}
      cancelLabel={copy.actions.cancel}
      onSave={handleSave}
      onCancel={onCancel}
    >
      {list.map((item, index) => (
        <ItemCard
          key={index}
          removeLabel={copy.actions.remove}
          removeAriaLabel={`${copy.actions.remove} ${copy.nouns.experience} ${index + 1}`}
          onRemove={() => {
            setList((current) => removeAt(current, index));
          }}
        >
          <TextField
            id={`cv-exp-role-${index}`}
            label={copy.fields.role}
            value={item.role ?? ""}
            onChange={(role) => {
              update(index, { role });
            }}
          />
          <TextField
            id={`cv-exp-org-${index}`}
            label={copy.fields.organization}
            value={item.organization ?? ""}
            onChange={(organization) => {
              update(index, { organization });
            }}
          />
          <TextField
            id={`cv-exp-location-${index}`}
            label={copy.fields.location}
            value={item.location ?? ""}
            onChange={(location) => {
              update(index, { location });
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`cv-exp-start-${index}`}
              label={copy.fields.startDate}
              value={item.startDate ?? ""}
              onChange={(startDate) => {
                update(index, { startDate });
              }}
            />
            <TextField
              id={`cv-exp-end-${index}`}
              label={copy.fields.endDate}
              value={item.endDate ?? ""}
              onChange={(endDate) => {
                update(index, { endDate });
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={item.isCurrent ?? false}
              onChange={(event) => {
                update(index, { isCurrent: event.target.checked });
              }}
              className="size-4 accent-emerald-700"
            />
            {copy.fields.isCurrent}
          </label>
          <TextAreaField
            id={`cv-exp-description-${index}`}
            label={copy.fields.experienceDescription}
            rows={4}
            value={item.description}
            onChange={(description) => {
              update(index, { description });
            }}
          />
          <StringListField
            label={copy.fields.highlights}
            items={item.highlights}
            itemNoun={copy.nouns.highlight}
            addLabel={copy.actions.addHighlight}
            removeLabel={copy.actions.remove}
            onChange={(highlights) => {
              update(index, { highlights });
            }}
          />
        </ItemCard>
      ))}
      <button
        type="button"
        onClick={() => {
          setList((current) => [...current, { description: "", highlights: [] }]);
        }}
        className={addButtonClass}
      >
        {copy.actions.addExperience}
      </button>
    </SectionEditFrame>
  );
}

export function EducationEditor({
  items,
  locale,
  onSave,
  onCancel,
}: {
  items: EducationItem[];
  locale: UiLocale;
  onSave: (value: EducationItem[]) => void;
  onCancel: () => void;
}) {
  const copy = getCvEditorCopy(locale);
  const [list, setList] = useState<EducationItem[]>(items);

  function update(index: number, patch: Partial<EducationItem>) {
    setList((current) => replaceAt(current, index, { ...current[index], ...patch }));
  }

  return (
    <SectionEditFrame
      title={copy.sections.education}
      ariaLabel={`${copy.actions.edit} ${copy.sections.education}`}
      saveLabel={copy.actions.save}
      cancelLabel={copy.actions.cancel}
      onSave={() => {
        onSave(list);
      }}
      onCancel={onCancel}
    >
      {list.map((item, index) => (
        <ItemCard
          key={index}
          removeLabel={copy.actions.remove}
          removeAriaLabel={`${copy.actions.remove} ${copy.nouns.education} ${index + 1}`}
          onRemove={() => {
            setList((current) => removeAt(current, index));
          }}
        >
          <TextField
            id={`cv-edu-program-${index}`}
            label={copy.fields.program}
            value={item.program ?? ""}
            onChange={(program) => {
              update(index, { program });
            }}
          />
          <TextField
            id={`cv-edu-institution-${index}`}
            label={copy.fields.institution}
            value={item.institution ?? ""}
            onChange={(institution) => {
              update(index, { institution });
            }}
          />
          <TextField
            id={`cv-edu-location-${index}`}
            label={copy.fields.location}
            value={item.location ?? ""}
            onChange={(location) => {
              update(index, { location });
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`cv-edu-start-${index}`}
              label={copy.fields.startDate}
              value={item.startDate ?? ""}
              onChange={(startDate) => {
                update(index, { startDate });
              }}
            />
            <TextField
              id={`cv-edu-end-${index}`}
              label={copy.fields.endDate}
              value={item.endDate ?? ""}
              onChange={(endDate) => {
                update(index, { endDate });
              }}
            />
          </div>
          <TextAreaField
            id={`cv-edu-description-${index}`}
            label={copy.fields.educationDescription}
            rows={4}
            value={item.description ?? ""}
            onChange={(description) => {
              update(index, { description });
            }}
          />
        </ItemCard>
      ))}
      <button
        type="button"
        onClick={() => {
          setList((current) => [...current, {}]);
        }}
        className={addButtonClass}
      >
        {copy.actions.addEducation}
      </button>
    </SectionEditFrame>
  );
}

export function SkillsEditor({
  groups,
  locale,
  onSave,
  onCancel,
}: {
  groups: SkillGroup[];
  locale: UiLocale;
  onSave: (value: SkillGroup[]) => void;
  onCancel: () => void;
}) {
  const copy = getCvEditorCopy(locale);
  const [list, setList] = useState<SkillGroup[]>(groups);
  const [errors, setErrors] = useState<Record<number, SkillGroupErrors | undefined>>({});

  function update(index: number, patch: Partial<SkillGroup>) {
    setList((current) => replaceAt(current, index, { ...current[index], ...patch }));
    if (errors[index]) {
      setErrors((current) => ({ ...current, [index]: undefined }));
    }
  }

  function handleSave() {
    const nextErrors: Record<number, SkillGroupErrors> = {};
    list.forEach((group, index) => {
      const found = validateSkillGroup(group);
      if (!isClean(found)) nextErrors[index] = found;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const cleaned = list.map((group) => ({ label: group.label.trim(), items: group.items.filter(hasText) }));
    onSave(cleaned);
  }

  return (
    <SectionEditFrame
      title={copy.sections.skills}
      ariaLabel={`${copy.actions.edit} ${copy.sections.skills}`}
      saveLabel={copy.actions.save}
      cancelLabel={copy.actions.cancel}
      onSave={handleSave}
      onCancel={onCancel}
    >
      {list.map((group, index) => (
        <ItemCard
          key={index}
          removeLabel={copy.actions.remove}
          removeAriaLabel={`${copy.actions.remove} ${copy.nouns.skillGroup} ${index + 1}`}
          onRemove={() => {
            setList((current) => {
              const next = removeAt(current, index);
              return next;
            });
          }}
        >
          <TextField
            id={`cv-skill-label-${index}`}
            label={copy.fields.skillGroupLabel}
            value={group.label}
            error={errors[index]?.label ? copy.validation.skillGroupLabelRequired : undefined}
            onChange={(label) => {
              update(index, { label });
            }}
          />
          <StringListField
            label={copy.fields.skillItems}
            items={group.items}
            itemNoun={copy.nouns.skill}
            addLabel={copy.actions.addSkillItem}
            removeLabel={copy.actions.remove}
            error={errors[index]?.items ? copy.validation.skillGroupItemsRequired : undefined}
            onChange={(items) => {
              update(index, { items });
            }}
          />
        </ItemCard>
      ))}
      <button
        type="button"
        onClick={() => {
          setList((current) => [...current, { label: "", items: [""] }]);
        }}
        className={addButtonClass}
      >
        {copy.actions.addSkillGroup}
      </button>
    </SectionEditFrame>
  );
}

export function LanguagesEditor({
  languages,
  locale,
  onSave,
  onCancel,
}: {
  languages: LanguageItem[];
  locale: UiLocale;
  onSave: (value: LanguageItem[]) => void;
  onCancel: () => void;
}) {
  const copy = getCvEditorCopy(locale);
  const [list, setList] = useState<LanguageItem[]>(languages);
  const [errors, setErrors] = useState<Record<number, LanguageErrors | undefined>>({});

  function update(index: number, patch: Partial<LanguageItem>) {
    setList((current) => replaceAt(current, index, { ...current[index], ...patch }));
    if (errors[index]) {
      setErrors((current) => ({ ...current, [index]: undefined }));
    }
  }

  function handleSave() {
    const nextErrors: Record<number, LanguageErrors> = {};
    list.forEach((language, index) => {
      const found = validateLanguage(language);
      if (!isClean(found)) nextErrors[index] = found;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const cleaned = list.map((language) => ({
      name: language.name.trim(),
      proficiency: hasText(language.proficiency) ? language.proficiency : undefined,
    }));
    onSave(cleaned);
  }

  return (
    <SectionEditFrame
      title={copy.sections.languages}
      ariaLabel={`${copy.actions.edit} ${copy.sections.languages}`}
      saveLabel={copy.actions.save}
      cancelLabel={copy.actions.cancel}
      onSave={handleSave}
      onCancel={onCancel}
    >
      {list.map((language, index) => (
        <ItemCard
          key={index}
          removeLabel={copy.actions.remove}
          removeAriaLabel={`${copy.actions.remove} ${copy.nouns.language} ${index + 1}`}
          onRemove={() => {
            setList((current) => removeAt(current, index));
          }}
        >
          <TextField
            id={`cv-language-name-${index}`}
            label={copy.fields.languageName}
            value={language.name}
            error={errors[index]?.name ? copy.validation.languageNameRequired : undefined}
            onChange={(name) => {
              update(index, { name });
            }}
          />
          <TextField
            id={`cv-language-proficiency-${index}`}
            label={copy.fields.languageProficiency}
            value={language.proficiency ?? ""}
            onChange={(proficiency) => {
              update(index, { proficiency });
            }}
          />
        </ItemCard>
      ))}
      <button
        type="button"
        onClick={() => {
          setList((current) => [...current, { name: "" }]);
        }}
        className={addButtonClass}
      >
        {copy.actions.addLanguage}
      </button>
    </SectionEditFrame>
  );
}
