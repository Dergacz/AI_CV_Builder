import { type ReactNode } from "react";

// Type-only import keeps zod (pulled in by cv-draft's runtime exports) out of this client island.
import type { GeneratedCvDraft } from "@/lib/cv-draft";
import { getCvEditorCopy } from "@/lib/cv-editor-copy";
import type { UiLocale } from "@/lib/i18n/locales";

type Sections = GeneratedCvDraft["sections"];

/**
 * Presentational, read-only render of a generated CV draft in the single clean template.
 *
 * Extracted from the questionnaire island's draft preview so the same structured draft can
 * be rendered in one place — S-05 editing reuses the per-section `*Content` renderers below,
 * and S-07 PDF export reuses this whole component. Renders only the five CV sections;
 * warnings/assumptions are editorial guidance and stay in the surrounding preview.
 *
 * S-09: section headings and empty-state copy are selected by the passed `locale`. On screen
 * this is the interface locale; the PDF export selects the same copy by the CV output language.
 */
export default function CvTemplate({ draft, locale }: { draft: GeneratedCvDraft; locale: UiLocale }) {
  const { sections } = draft;
  const copy = getCvEditorCopy(locale);

  return (
    <div className="mt-6 space-y-6">
      <DraftSection title={copy.sections.summary}>
        <SummaryContent summary={sections.summary} />
      </DraftSection>
      <DraftSection title={copy.sections.experience}>
        <ExperienceContent items={sections.experience} locale={locale} />
      </DraftSection>
      <DraftSection title={copy.sections.education}>
        <EducationContent items={sections.education} locale={locale} />
      </DraftSection>
      <DraftSection title={copy.sections.skills}>
        <SkillsContent groups={sections.skills} locale={locale} />
      </DraftSection>
      <DraftSection title={copy.sections.languages}>
        <LanguagesContent languages={sections.languages} locale={locale} />
      </DraftSection>
    </div>
  );
}

export function SummaryContent({ summary }: { summary: Sections["summary"] }) {
  return (
    <>
      {summary.headline && <p className="font-medium text-slate-900">{summary.headline}</p>}
      <p className="text-sm leading-6 whitespace-pre-wrap text-slate-700">{summary.body}</p>
    </>
  );
}

export function ExperienceContent({ items, locale }: { items: Sections["experience"]; locale: UiLocale }) {
  const copy = getCvEditorCopy(locale);
  if (items.length === 0) {
    return <EmptyNote>{copy.emptyStates.experience}</EmptyNote>;
  }
  return (
    <ul className="space-y-4">
      {items.map((item, index) => {
        const heading = [item.role, item.organization].filter(Boolean).join(" · ");
        const meta = [item.location, formatExperienceDates(item, locale)].filter(Boolean).join(" · ");
        return (
          <li key={index} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
            <p className="font-medium text-slate-900">{heading || copy.labels.experienceItemFallback}</p>
            {meta && <p className="text-xs text-slate-500">{meta}</p>}
            <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-slate-700">{item.description}</p>
            {item.highlights.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm leading-6 text-slate-700">
                {item.highlights.map((highlight, highlightIndex) => (
                  <li key={highlightIndex}>{highlight}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function EducationContent({ items, locale }: { items: Sections["education"]; locale: UiLocale }) {
  const copy = getCvEditorCopy(locale);
  if (items.length === 0) {
    return <EmptyNote>{copy.emptyStates.education}</EmptyNote>;
  }
  return (
    <ul className="space-y-4">
      {items.map((item, index) => {
        const heading = [item.program, item.institution].filter(Boolean).join(" · ");
        const meta = [item.location, item.startDate, item.endDate].filter(Boolean).join(" · ");
        return (
          <li key={index} className="rounded-md border border-slate-100 bg-slate-50/60 p-3">
            <p className="font-medium text-slate-900">{heading || copy.labels.educationItemFallback}</p>
            {meta && <p className="text-xs text-slate-500">{meta}</p>}
            {item.description && (
              <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-slate-700">{item.description}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SkillsContent({ groups, locale }: { groups: Sections["skills"]; locale: UiLocale }) {
  const copy = getCvEditorCopy(locale);
  if (groups.length === 0) {
    return <EmptyNote>{copy.emptyStates.skills}</EmptyNote>;
  }
  return (
    <ul className="space-y-2">
      {groups.map((group, index) => (
        <li key={`${group.label}-${index}`} className="text-sm leading-6 text-slate-700">
          <span className="font-medium text-slate-900">{group.label}:</span> {group.items.join(", ")}
        </li>
      ))}
    </ul>
  );
}

export function LanguagesContent({ languages, locale }: { languages: Sections["languages"]; locale: UiLocale }) {
  const copy = getCvEditorCopy(locale);
  if (languages.length === 0) {
    return <EmptyNote>{copy.emptyStates.languages}</EmptyNote>;
  }
  return (
    <ul className="space-y-1">
      {languages.map((language, index) => (
        <li key={`${language.name}-${index}`} className="text-sm leading-6 text-slate-700">
          <span className="font-medium text-slate-900">{language.name}</span>
          {language.proficiency ? ` — ${language.proficiency}` : ""}
        </li>
      ))}
    </ul>
  );
}

function formatExperienceDates(item: Sections["experience"][number], locale: UiLocale): string {
  const end = item.endDate ?? (item.isCurrent ? getCvEditorCopy(locale).labels.present : undefined);
  if (item.startDate && end) return `${item.startDate} – ${end}`;
  return item.startDate ?? end ?? "";
}

/** Section wrapper: uppercase title above content. Shared by the template and the editor's read view. */
export function DraftSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
        {action}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-slate-400">{children}</p>;
}
