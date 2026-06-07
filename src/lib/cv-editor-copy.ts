/**
 * Centralized S-05 (CV template & section editing) user-facing copy — zod-free, no React.
 *
 * Single home for every string the CV template and section editors render. S-09
 * (interface localization) turned the former English singleton into a locale-indexed
 * catalog: `cvEditorCopyByLocale[locale]` / `getCvEditorCopy(locale)`. The module stays
 * zod-free and React-free so both server code and client islands can import it.
 *
 * Boundary note: the on-screen editor chrome follows the *interface* locale, but the
 * exported PDF selects these same section headings by the *CV output language*
 * (`CvPdfDocument` passes the draft's output language), so interface language never
 * overrides the exported document's content language.
 */

import type { UiLocale } from "@/lib/i18n/locales";

export interface CvEditorCopy {
  preview: {
    eyebrow: string;
    title: string;
    description: string;
    editAnswers: string;
    warningsTitle: string;
    assumptionsTitle: string;
    regenerateLink: string;
    draftAriaLabel: string;
    warningsAriaLabel: string;
    assumptionsAriaLabel: string;
  };
  sections: {
    summary: string;
    experience: string;
    education: string;
    skills: string;
    languages: string;
  };
  emptyStates: {
    experience: string;
    education: string;
    skills: string;
    languages: string;
  };
  labels: {
    present: string;
    experienceItemFallback: string;
    educationItemFallback: string;
  };
  actions: {
    edit: string;
    save: string;
    cancel: string;
    remove: string;
    addExperience: string;
    addEducation: string;
    addSkillGroup: string;
    addLanguage: string;
    addHighlight: string;
    addSkillItem: string;
  };
  fields: {
    summaryHeadline: string;
    summaryBody: string;
    role: string;
    organization: string;
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: string;
    experienceDescription: string;
    highlights: string;
    institution: string;
    program: string;
    educationDescription: string;
    skillGroupLabel: string;
    skillItems: string;
    languageName: string;
    languageProficiency: string;
  };
  validation: {
    summaryBodyRequired: string;
    skillGroupLabelRequired: string;
    skillGroupItemsRequired: string;
    languageNameRequired: string;
  };
  regenerate: {
    confirmTitle: string;
    confirmBody: string;
    confirm: string;
    cancel: string;
  };
  /** Singular item nouns used only inside composed aria-labels (not visible text). */
  nouns: {
    experience: string;
    education: string;
    skillGroup: string;
    language: string;
    highlight: string;
    skill: string;
  };
}

export const cvEditorCopyByLocale = {
  en: {
    preview: {
      eyebrow: "Draft preview",
      title: "Your generated CV draft",
      description:
        "This is an early draft generated from your answers. A clean template and section editing come next; nothing is saved or exported yet.",
      editAnswers: "Edit answers",
      warningsTitle: "Before you rely on this draft",
      assumptionsTitle: "Editorial assumptions",
      regenerateLink: "Edit answers and regenerate",
      draftAriaLabel: "Generated CV draft",
      warningsAriaLabel: "Draft warnings",
      assumptionsAriaLabel: "Draft assumptions",
    },
    sections: {
      summary: "Summary",
      experience: "Experience",
      education: "Education",
      skills: "Skills",
      languages: "Languages",
    },
    emptyStates: {
      experience: "No experience was added.",
      education: "No education was added.",
      skills: "No skills were added.",
      languages: "No languages were added.",
    },
    labels: {
      present: "Present",
      experienceItemFallback: "Experience",
      educationItemFallback: "Education",
    },
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
    validation: {
      summaryBodyRequired: "Add a short summary so the CV has an opening.",
      skillGroupLabelRequired: "Give this skill group a name.",
      skillGroupItemsRequired: "Add at least one skill to this group.",
      languageNameRequired: "Add the language name.",
    },
    regenerate: {
      confirmTitle: "Discard your edits?",
      confirmBody: "Regenerating builds a fresh draft and replaces the edits you've made here.",
      confirm: "Discard and edit answers",
      cancel: "Keep editing",
    },
    nouns: {
      experience: "experience",
      education: "education",
      skillGroup: "skill group",
      language: "language",
      highlight: "highlight",
      skill: "skill",
    },
  },
  pl: {
    preview: {
      eyebrow: "Podgląd szkicu",
      title: "Twój wygenerowany szkic CV",
      description:
        "To wczesny szkic utworzony na podstawie Twoich odpowiedzi. Czysty szablon i edycja sekcji są w kolejnym kroku; nic nie jest jeszcze zapisane ani wyeksportowane.",
      editAnswers: "Edytuj odpowiedzi",
      warningsTitle: "Zanim zaufasz temu szkicowi",
      assumptionsTitle: "Założenia redakcyjne",
      regenerateLink: "Edytuj odpowiedzi i wygeneruj ponownie",
      draftAriaLabel: "Wygenerowany szkic CV",
      warningsAriaLabel: "Ostrzeżenia szkicu",
      assumptionsAriaLabel: "Założenia szkicu",
    },
    sections: {
      summary: "Podsumowanie",
      experience: "Doświadczenie",
      education: "Wykształcenie",
      skills: "Umiejętności",
      languages: "Języki",
    },
    emptyStates: {
      experience: "Nie dodano doświadczenia.",
      education: "Nie dodano wykształcenia.",
      skills: "Nie dodano umiejętności.",
      languages: "Nie dodano języków.",
    },
    labels: {
      present: "Obecnie",
      experienceItemFallback: "Doświadczenie",
      educationItemFallback: "Wykształcenie",
    },
    actions: {
      edit: "Edytuj",
      save: "Zapisz",
      cancel: "Anuluj",
      remove: "Usuń",
      addExperience: "Dodaj doświadczenie",
      addEducation: "Dodaj wykształcenie",
      addSkillGroup: "Dodaj grupę umiejętności",
      addLanguage: "Dodaj język",
      addHighlight: "Dodaj wyróżnienie",
      addSkillItem: "Dodaj umiejętność",
    },
    fields: {
      summaryHeadline: "Nagłówek (opcjonalnie)",
      summaryBody: "Podsumowanie",
      role: "Stanowisko (opcjonalnie)",
      organization: "Organizacja (opcjonalnie)",
      location: "Lokalizacja (opcjonalnie)",
      startDate: "Początek (opcjonalnie)",
      endDate: "Koniec (opcjonalnie)",
      isCurrent: "Obecnie tu pracuję",
      experienceDescription: "Opis (opcjonalnie)",
      highlights: "Wyróżnienia (opcjonalnie)",
      institution: "Instytucja (opcjonalnie)",
      program: "Kierunek (opcjonalnie)",
      educationDescription: "Opis (opcjonalnie)",
      skillGroupLabel: "Nazwa grupy",
      skillItems: "Umiejętności",
      languageName: "Język",
      languageProficiency: "Poziom (opcjonalnie)",
    },
    validation: {
      summaryBodyRequired: "Dodaj krótkie podsumowanie, aby CV miało wstęp.",
      skillGroupLabelRequired: "Nadaj nazwę tej grupie umiejętności.",
      skillGroupItemsRequired: "Dodaj co najmniej jedną umiejętność do tej grupy.",
      languageNameRequired: "Dodaj nazwę języka.",
    },
    regenerate: {
      confirmTitle: "Odrzucić zmiany?",
      confirmBody: "Ponowne wygenerowanie tworzy nowy szkic i zastępuje wprowadzone tu zmiany.",
      confirm: "Odrzuć i edytuj odpowiedzi",
      cancel: "Kontynuuj edycję",
    },
    nouns: {
      experience: "doświadczenie",
      education: "wykształcenie",
      skillGroup: "grupa umiejętności",
      language: "język",
      highlight: "wyróżnienie",
      skill: "umiejętność",
    },
  },
  ru: {
    preview: {
      eyebrow: "Предпросмотр черновика",
      title: "Ваш сгенерированный черновик CV",
      description:
        "Это предварительный черновик, созданный из ваших ответов. Чистый шаблон и редактирование разделов — на следующем шаге; пока ничего не сохранено и не экспортировано.",
      editAnswers: "Изменить ответы",
      warningsTitle: "Прежде чем полагаться на этот черновик",
      assumptionsTitle: "Редакторские допущения",
      regenerateLink: "Изменить ответы и сгенерировать заново",
      draftAriaLabel: "Сгенерированный черновик CV",
      warningsAriaLabel: "Предупреждения черновика",
      assumptionsAriaLabel: "Допущения черновика",
    },
    sections: {
      summary: "Резюме",
      experience: "Опыт",
      education: "Образование",
      skills: "Навыки",
      languages: "Языки",
    },
    emptyStates: {
      experience: "Опыт не добавлен.",
      education: "Образование не добавлено.",
      skills: "Навыки не добавлены.",
      languages: "Языки не добавлены.",
    },
    labels: {
      present: "По настоящее время",
      experienceItemFallback: "Опыт",
      educationItemFallback: "Образование",
    },
    actions: {
      edit: "Изменить",
      save: "Сохранить",
      cancel: "Отмена",
      remove: "Удалить",
      addExperience: "Добавить опыт",
      addEducation: "Добавить образование",
      addSkillGroup: "Добавить группу навыков",
      addLanguage: "Добавить язык",
      addHighlight: "Добавить достижение",
      addSkillItem: "Добавить навык",
    },
    fields: {
      summaryHeadline: "Заголовок (необязательно)",
      summaryBody: "Резюме",
      role: "Должность (необязательно)",
      organization: "Организация (необязательно)",
      location: "Местоположение (необязательно)",
      startDate: "Начало (необязательно)",
      endDate: "Окончание (необязательно)",
      isCurrent: "Работаю здесь сейчас",
      experienceDescription: "Описание (необязательно)",
      highlights: "Достижения (необязательно)",
      institution: "Учебное заведение (необязательно)",
      program: "Программа (необязательно)",
      educationDescription: "Описание (необязательно)",
      skillGroupLabel: "Название группы",
      skillItems: "Навыки",
      languageName: "Язык",
      languageProficiency: "Уровень (необязательно)",
    },
    validation: {
      summaryBodyRequired: "Добавьте краткое резюме, чтобы у CV было начало.",
      skillGroupLabelRequired: "Дайте название этой группе навыков.",
      skillGroupItemsRequired: "Добавьте хотя бы один навык в эту группу.",
      languageNameRequired: "Укажите название языка.",
    },
    regenerate: {
      confirmTitle: "Отменить изменения?",
      confirmBody: "Повторная генерация создаёт новый черновик и заменяет внесённые здесь изменения.",
      confirm: "Отменить и изменить ответы",
      cancel: "Продолжить редактирование",
    },
    nouns: {
      experience: "опыт",
      education: "образование",
      skillGroup: "группа навыков",
      language: "язык",
      highlight: "достижение",
      skill: "навык",
    },
  },
} satisfies Record<UiLocale, CvEditorCopy>;

export function getCvEditorCopy(locale: UiLocale): CvEditorCopy {
  return cvEditorCopyByLocale[locale];
}

/**
 * English singleton retained for the zod-free schema guards in `cv-draft-validation.ts`,
 * which run independently of interface locale and only need a stable message source. UI
 * surfaces must select localized copy via `getCvEditorCopy(locale)` instead.
 */
export const cvEditorCopy = cvEditorCopyByLocale.en;
