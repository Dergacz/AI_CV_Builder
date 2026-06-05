import { useState, type ReactNode } from "react";

import type { EducationItem, ExperienceItem, LanguageItem, SkillGroup, SummarySection } from "@/lib/cv-draft";
import { cvEditorCopy } from "@/lib/cv-editor-copy";
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
  onSave,
  onCancel,
  children,
}: {
  title: string;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={`Edit ${title}`}>
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      <div className="mt-3 space-y-4">{children}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onSave} className={saveButtonClass}>
          {cvEditorCopy.actions.save}
        </button>
        <button type="button" onClick={onCancel} className={cancelButtonClass}>
          {cvEditorCopy.actions.cancel}
        </button>
      </div>
    </section>
  );
}

function ItemCard({
  removeLabel,
  onRemove,
  children,
}: {
  removeLabel: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex justify-end">
        <button type="button" onClick={onRemove} className={removeButtonClass} aria-label={removeLabel}>
          {cvEditorCopy.actions.remove}
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
  error,
  onChange,
}: {
  label: string;
  items: string[];
  itemNoun: string;
  addLabel: string;
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
                aria-label={`${cvEditorCopy.actions.remove} ${itemNoun.toLowerCase()} ${index + 1}`}
              >
                {cvEditorCopy.actions.remove}
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
  onSave,
  onCancel,
}: {
  summary: SummarySection;
  onSave: (value: SummarySection) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<SummarySection>(summary);
  const [errors, setErrors] = useState<SummaryErrors>({});

  function handleSave() {
    const found = validateSummary(value);
    setErrors(found);
    if (!isClean(found)) return;
    onSave({ headline: hasText(value.headline) ? value.headline : undefined, body: value.body });
  }

  return (
    <SectionEditFrame title={cvEditorCopy.sections.summary} onSave={handleSave} onCancel={onCancel}>
      <TextField
        id="cv-summary-headline"
        label={cvEditorCopy.fields.summaryHeadline}
        value={value.headline ?? ""}
        onChange={(headline) => {
          setValue((current) => ({ ...current, headline }));
        }}
      />
      <TextAreaField
        id="cv-summary-body"
        label={cvEditorCopy.fields.summaryBody}
        rows={5}
        value={value.body}
        error={errors.body}
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
  onSave,
  onCancel,
}: {
  items: ExperienceItem[];
  onSave: (value: ExperienceItem[]) => void;
  onCancel: () => void;
}) {
  const [list, setList] = useState<ExperienceItem[]>(items);

  function update(index: number, patch: Partial<ExperienceItem>) {
    setList((current) => replaceAt(current, index, { ...current[index], ...patch }));
  }

  function handleSave() {
    const cleaned = list.map((item) => ({ ...item, highlights: item.highlights.filter(hasText) }));
    onSave(cleaned);
  }

  return (
    <SectionEditFrame title={cvEditorCopy.sections.experience} onSave={handleSave} onCancel={onCancel}>
      {list.map((item, index) => (
        <ItemCard
          key={index}
          removeLabel={`${cvEditorCopy.actions.remove} experience ${index + 1}`}
          onRemove={() => {
            setList((current) => removeAt(current, index));
          }}
        >
          <TextField
            id={`cv-exp-role-${index}`}
            label={cvEditorCopy.fields.role}
            value={item.role ?? ""}
            onChange={(role) => {
              update(index, { role });
            }}
          />
          <TextField
            id={`cv-exp-org-${index}`}
            label={cvEditorCopy.fields.organization}
            value={item.organization ?? ""}
            onChange={(organization) => {
              update(index, { organization });
            }}
          />
          <TextField
            id={`cv-exp-location-${index}`}
            label={cvEditorCopy.fields.location}
            value={item.location ?? ""}
            onChange={(location) => {
              update(index, { location });
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`cv-exp-start-${index}`}
              label={cvEditorCopy.fields.startDate}
              value={item.startDate ?? ""}
              onChange={(startDate) => {
                update(index, { startDate });
              }}
            />
            <TextField
              id={`cv-exp-end-${index}`}
              label={cvEditorCopy.fields.endDate}
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
            {cvEditorCopy.fields.isCurrent}
          </label>
          <TextAreaField
            id={`cv-exp-description-${index}`}
            label={cvEditorCopy.fields.experienceDescription}
            rows={4}
            value={item.description}
            onChange={(description) => {
              update(index, { description });
            }}
          />
          <StringListField
            label={cvEditorCopy.fields.highlights}
            items={item.highlights}
            itemNoun="Highlight"
            addLabel={cvEditorCopy.actions.addHighlight}
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
        {cvEditorCopy.actions.addExperience}
      </button>
    </SectionEditFrame>
  );
}

export function EducationEditor({
  items,
  onSave,
  onCancel,
}: {
  items: EducationItem[];
  onSave: (value: EducationItem[]) => void;
  onCancel: () => void;
}) {
  const [list, setList] = useState<EducationItem[]>(items);

  function update(index: number, patch: Partial<EducationItem>) {
    setList((current) => replaceAt(current, index, { ...current[index], ...patch }));
  }

  return (
    <SectionEditFrame
      title={cvEditorCopy.sections.education}
      onSave={() => {
        onSave(list);
      }}
      onCancel={onCancel}
    >
      {list.map((item, index) => (
        <ItemCard
          key={index}
          removeLabel={`${cvEditorCopy.actions.remove} education ${index + 1}`}
          onRemove={() => {
            setList((current) => removeAt(current, index));
          }}
        >
          <TextField
            id={`cv-edu-program-${index}`}
            label={cvEditorCopy.fields.program}
            value={item.program ?? ""}
            onChange={(program) => {
              update(index, { program });
            }}
          />
          <TextField
            id={`cv-edu-institution-${index}`}
            label={cvEditorCopy.fields.institution}
            value={item.institution ?? ""}
            onChange={(institution) => {
              update(index, { institution });
            }}
          />
          <TextField
            id={`cv-edu-location-${index}`}
            label={cvEditorCopy.fields.location}
            value={item.location ?? ""}
            onChange={(location) => {
              update(index, { location });
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`cv-edu-start-${index}`}
              label={cvEditorCopy.fields.startDate}
              value={item.startDate ?? ""}
              onChange={(startDate) => {
                update(index, { startDate });
              }}
            />
            <TextField
              id={`cv-edu-end-${index}`}
              label={cvEditorCopy.fields.endDate}
              value={item.endDate ?? ""}
              onChange={(endDate) => {
                update(index, { endDate });
              }}
            />
          </div>
          <TextAreaField
            id={`cv-edu-description-${index}`}
            label={cvEditorCopy.fields.educationDescription}
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
        {cvEditorCopy.actions.addEducation}
      </button>
    </SectionEditFrame>
  );
}

export function SkillsEditor({
  groups,
  onSave,
  onCancel,
}: {
  groups: SkillGroup[];
  onSave: (value: SkillGroup[]) => void;
  onCancel: () => void;
}) {
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
    <SectionEditFrame title={cvEditorCopy.sections.skills} onSave={handleSave} onCancel={onCancel}>
      {list.map((group, index) => (
        <ItemCard
          key={index}
          removeLabel={`${cvEditorCopy.actions.remove} skill group ${index + 1}`}
          onRemove={() => {
            setList((current) => {
              const next = removeAt(current, index);
              return next;
            });
          }}
        >
          <TextField
            id={`cv-skill-label-${index}`}
            label={cvEditorCopy.fields.skillGroupLabel}
            value={group.label}
            error={errors[index]?.label}
            onChange={(label) => {
              update(index, { label });
            }}
          />
          <StringListField
            label={cvEditorCopy.fields.skillItems}
            items={group.items}
            itemNoun="Skill"
            addLabel={cvEditorCopy.actions.addSkillItem}
            error={errors[index]?.items}
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
        {cvEditorCopy.actions.addSkillGroup}
      </button>
    </SectionEditFrame>
  );
}

export function LanguagesEditor({
  languages,
  onSave,
  onCancel,
}: {
  languages: LanguageItem[];
  onSave: (value: LanguageItem[]) => void;
  onCancel: () => void;
}) {
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
    <SectionEditFrame title={cvEditorCopy.sections.languages} onSave={handleSave} onCancel={onCancel}>
      {list.map((language, index) => (
        <ItemCard
          key={index}
          removeLabel={`${cvEditorCopy.actions.remove} language ${index + 1}`}
          onRemove={() => {
            setList((current) => removeAt(current, index));
          }}
        >
          <TextField
            id={`cv-language-name-${index}`}
            label={cvEditorCopy.fields.languageName}
            value={language.name}
            error={errors[index]?.name}
            onChange={(name) => {
              update(index, { name });
            }}
          />
          <TextField
            id={`cv-language-proficiency-${index}`}
            label={cvEditorCopy.fields.languageProficiency}
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
        {cvEditorCopy.actions.addLanguage}
      </button>
    </SectionEditFrame>
  );
}
