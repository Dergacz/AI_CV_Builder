export const QUESTIONNAIRE_VERSION = "mvp-v1";

export const cvOutputLanguages = ["en", "pl", "ru"] as const;

export type CvOutputLanguage = (typeof cvOutputLanguages)[number];

export interface CvQuestionnaireAnswers {
  fullName: string;
  targetRoleOrGoal: string;
  outputLanguage: CvOutputLanguage;
  experience: string;
  education: string;
  skillsAndTools: string;
  spokenLanguages: string;
  additionalContext: string;
}

export const defaultCvQuestionnaireAnswers: CvQuestionnaireAnswers = {
  fullName: "",
  targetRoleOrGoal: "",
  outputLanguage: "en",
  experience: "",
  education: "",
  skillsAndTools: "",
  spokenLanguages: "",
  additionalContext: "",
};
