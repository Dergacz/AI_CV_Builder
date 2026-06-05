/**
 * Centralized S-05 (CV template & section editing) user-facing copy — zod-free, no React.
 *
 * Single home for every string the CV template and section editors render, so S-09
 * (interface localization) can wrap one module per locale instead of combing JSX.
 * Mirrors the role of `cv-draft-messages.ts`. English values only for now; the
 * per-CV output language is unrelated to this UI copy.
 *
 * Phase 1 consumes `preview`, `sections`, `emptyStates`, and `labels`. The `actions`,
 * `validation`, and `regenerate` groups are registered here up front so the Phase 2/3
 * editors reference one source instead of introducing new inline strings.
 */
export const cvEditorCopy = {
  /** DraftPreview chrome around the template (header, warnings, assumptions, regenerate). */
  preview: {
    eyebrow: "Draft preview",
    title: "Your generated CV draft",
    description:
      "This is an early draft generated from your answers. A clean template and section editing come next; nothing is saved or exported yet.",
    editAnswers: "Edit answers",
    warningsTitle: "Before you rely on this draft",
    assumptionsTitle: "Editorial assumptions",
    regenerateLink: "Edit answers and regenerate",
  },

  /** Section heading labels, shared by the read-only template and the editors. */
  sections: {
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    languages: "Languages",
  },

  /** Empty-state notes when an array section has no items. */
  emptyStates: {
    experience: "No experience was added.",
    education: "No education was added.",
    skills: "No skills were added.",
    languages: "No languages were added.",
  },

  /** Misc inline labels and fallbacks. */
  labels: {
    present: "Present",
    experienceItemFallback: "Experience",
    educationItemFallback: "Education",
  },

  /** Edit/Save/Cancel and add/remove affordances (Phase 2). */
  actions: {
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove",
    addExperience: "Add experience",
    addEducation: "Add education",
    addSkillGroup: "Add skill group",
    addLanguage: "Add language",
    addHighlight: "Add highlight",
    addSkillItem: "Add skill",
  },

  /** Field labels and placeholders for the section editors (Phase 2). */
  fields: {
    summaryHeadline: "Headline (optional)",
    summaryBody: "Summary",
    role: "Role (optional)",
    organization: "Organization (optional)",
    location: "Location (optional)",
    startDate: "Start (optional)",
    endDate: "End (optional)",
    isCurrent: "I currently work here",
    experienceDescription: "Description (optional)",
    highlights: "Highlights (optional)",
    institution: "Institution (optional)",
    program: "Program (optional)",
    educationDescription: "Description (optional)",
    skillGroupLabel: "Group name",
    skillItems: "Skills",
    languageName: "Language",
    languageProficiency: "Proficiency (optional)",
  },

  /** Inline validation messages for schema-required fields (Phase 2). */
  validation: {
    summaryBodyRequired: "Add a short summary so the CV has an opening.",
    skillGroupLabelRequired: "Give this skill group a name.",
    skillGroupItemsRequired: "Add at least one skill to this group.",
    languageNameRequired: "Add the language name.",
  },

  /** Confirm-before-discard copy for the regenerate path (Phase 3). */
  regenerate: {
    confirmTitle: "Discard your edits?",
    confirmBody: "Regenerating builds a fresh draft and replaces the edits you've made here.",
    confirm: "Discard and edit answers",
    cancel: "Keep editing",
  },
} as const;
