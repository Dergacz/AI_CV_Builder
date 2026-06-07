import { useMemo, useState } from "react";
import {
  QUESTIONNAIRE_VERSION,
  cvOutputLanguages,
  defaultCvQuestionnaireAnswers,
  type CvQuestionnaireAnswers,
} from "@/lib/cv-questionnaire";
// Type-only import: keeps zod (pulled in by cv-draft's runtime exports) out of this client island.
import type { GeneratedCvDraft, GenerateDraftResponse } from "@/lib/cv-draft";
// Value import from the zod-free messages module so client and server share one source of error copy.
import { getGenerationErrorMessages } from "@/lib/cv-draft-messages";
import { defaultCvTitle } from "@/lib/cv-library-copy";
import { getMessages } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";
import CvEditor from "@/components/cv/CvEditor";
import { TextAreaField, TextField } from "@/components/cv/CvFormFields";
import { useCvDraftEditor } from "@/components/hooks/useCvDraftEditor";
import { useCvSave } from "@/components/hooks/useCvSave";
import { cn } from "@/lib/utils";

type StepKey = "basics" | "experienceEducation" | "skillsLanguages" | "extraContext" | "review";
type RequiredErrors = Partial<Record<"fullName" | "targetRoleOrGoal", string>>;
type GenerationStatus = "idle" | "loading" | "success" | "error";

const GENERATE_ENDPOINT = "/api/cv/generate";

const STEP_KEYS: StepKey[] = ["basics", "experienceEducation", "skillsLanguages", "extraContext", "review"];

function isRequiredField(field: keyof CvQuestionnaireAnswers): field is keyof RequiredErrors {
  return field === "fullName" || field === "targetRoleOrGoal";
}

export default function QuestionnaireFlow({ locale }: { locale: UiLocale }) {
  const copy = getMessages(locale).questionnaire;
  const genErrors = getGenerationErrorMessages(locale);

  const [answers, setAnswers] = useState<CvQuestionnaireAnswers>(defaultCvQuestionnaireAnswers);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [errors, setErrors] = useState<RequiredErrors>({});
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [draft, setDraft] = useState<GeneratedCvDraft | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const editor = useCvDraftEditor(setDraft);
  const save = useCvSave({ locale });

  const activeStepKey = STEP_KEYS[activeStepIndex];
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === STEP_KEYS.length - 1;
  const isGenerating = status === "loading";
  const sparseWarnings = useMemo(() => getSparseWarnings(answers, copy.sparseWarnings), [answers, copy.sparseWarnings]);

  async function handleGenerate() {
    setStatus("loading");
    setGenerationError(null);
    try {
      const response = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = (await response.json()) as GenerateDraftResponse;
      if (data.ok) {
        setDraft(data.draft);
        setStatus("success");
        // Seed an editable default title now that the answers are final.
        if (!save.title.trim()) {
          save.setTitle(defaultCvTitle(answers, new Date()));
        }
      } else {
        // Localize the stable error bucket (server prose is ignored on the client).
        setGenerationError(genErrors[data.error]);
        setStatus("error");
      }
    } catch {
      // Network failure or non-JSON response — treat as a temporary service issue.
      setGenerationError(genErrors.service_unavailable);
      setStatus("error");
    }
  }

  function handleEditAnswers() {
    setStatus("idle");
    setGenerationError(null);
    setActiveStepIndex(STEP_KEYS.length - 1);
  }

  function updateAnswer<Field extends keyof CvQuestionnaireAnswers>(
    field: Field,
    value: CvQuestionnaireAnswers[Field],
  ) {
    setAnswers((current) => ({ ...current, [field]: value }));

    if (isRequiredField(field) && errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function validateBasics() {
    const nextErrors: RequiredErrors = {};

    if (!answers.fullName.trim()) {
      nextErrors.fullName = copy.validation.fullNameRequired;
    }

    if (!answers.targetRoleOrGoal.trim()) {
      nextErrors.targetRoleOrGoal = copy.validation.targetRoleRequired;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goNext() {
    if (activeStepKey === "basics" && !validateBasics()) return;
    if (isLastStep) return;
    setActiveStepIndex((current) => current + 1);
  }

  function goBack() {
    if (isFirstStep) return;
    setActiveStepIndex((current) => current - 1);
  }

  if (status === "success" && draft) {
    return (
      <CvEditor
        draft={draft}
        editor={editor}
        save={save}
        answers={answers}
        locale={locale}
        onEditAnswers={handleEditAnswers}
      />
    );
  }

  const activeStep = copy.steps[activeStepKey];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label={copy.ariaLabel}>
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">
            {copy.versionLabel} {QUESTIONNAIRE_VERSION}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">{activeStep.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeStep.body}</p>
        </div>
        <p className="text-sm font-medium text-slate-500">{copy.stepProgress(activeStepIndex + 1, STEP_KEYS.length)}</p>
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-4" aria-label={copy.progressAriaLabel}>
        {STEP_KEYS.map((stepKey, index) => (
          <li key={stepKey}>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => {
                if (activeStepKey === "basics" && index > activeStepIndex && !validateBasics()) return;
                setActiveStepIndex(index);
              }}
              className={cn(
                "min-h-11 w-full rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                index === activeStepIndex
                  ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {copy.steps[stepKey].label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 min-h-[28rem]">
        {activeStepKey === "basics" && (
          <div className="space-y-5">
            <TextField
              id="fullName"
              label={copy.basics.fullNameLabel}
              value={answers.fullName}
              onChange={(value) => {
                updateAnswer("fullName", value);
              }}
              placeholder={copy.basics.fullNamePlaceholder}
              error={errors.fullName}
            />
            <TextAreaField
              id="targetRoleOrGoal"
              label={copy.basics.targetRoleLabel}
              value={answers.targetRoleOrGoal}
              onChange={(value) => {
                updateAnswer("targetRoleOrGoal", value);
              }}
              placeholder={copy.basics.targetRolePlaceholder}
              error={errors.targetRoleOrGoal}
            />
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">{copy.basics.outputLanguageLegend}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {cvOutputLanguages.map((language) => (
                  <label
                    key={language}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      answers.outputLanguage === language
                        ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                    )}
                  >
                    <input
                      type="radio"
                      name="outputLanguage"
                      value={language}
                      checked={answers.outputLanguage === language}
                      onChange={() => {
                        updateAnswer("outputLanguage", language);
                      }}
                      className="size-4 accent-emerald-700"
                    />
                    {copy.outputLanguageNames[language]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {activeStepKey === "experienceEducation" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <TextAreaField
              id="experience"
              label={copy.experienceStep.experienceLabel}
              value={answers.experience}
              onChange={(value) => {
                updateAnswer("experience", value);
              }}
              placeholder={copy.experienceStep.experiencePlaceholder}
            />
            <TextAreaField
              id="education"
              label={copy.experienceStep.educationLabel}
              value={answers.education}
              onChange={(value) => {
                updateAnswer("education", value);
              }}
              placeholder={copy.experienceStep.educationPlaceholder}
            />
          </div>
        )}

        {activeStepKey === "skillsLanguages" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <TextAreaField
              id="skillsAndTools"
              label={copy.skillsStep.skillsLabel}
              value={answers.skillsAndTools}
              onChange={(value) => {
                updateAnswer("skillsAndTools", value);
              }}
              placeholder={copy.skillsStep.skillsPlaceholder}
            />
            <TextAreaField
              id="spokenLanguages"
              label={copy.skillsStep.spokenLanguagesLabel}
              value={answers.spokenLanguages}
              onChange={(value) => {
                updateAnswer("spokenLanguages", value);
              }}
              placeholder={copy.skillsStep.spokenLanguagesPlaceholder}
            />
          </div>
        )}

        {activeStepKey === "extraContext" && (
          <div className="space-y-5">
            <TextAreaField
              id="additionalContext"
              label={copy.extraContext.label}
              value={answers.additionalContext}
              onChange={(value) => {
                updateAnswer("additionalContext", value);
              }}
              placeholder={copy.extraContext.placeholder}
            />
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              {copy.extraContext.note}
            </div>
          </div>
        )}

        {activeStepKey === "review" && (
          <div className="space-y-6">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              {copy.review.intro}
            </div>

            {isGenerating && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700"
              >
                <Spinner />
                {copy.loadingText}
              </div>
            )}

            {status === "error" && generationError && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"
              >
                {generationError}
                {copy.errorRetrySuffix}
              </div>
            )}

            {sparseWarnings.length > 0 && (
              <section
                className="rounded-md border border-amber-200 bg-amber-50 p-4"
                aria-label={copy.review.sparseNotesAriaLabel}
              >
                <h3 className="text-sm font-semibold text-amber-950">{copy.review.sparseTitle}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                  {sparseWarnings.map((warning) => (
                    <li key={warning}>- {warning}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <ReviewItem
                label={copy.review.labels.name}
                value={answers.fullName}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(0);
                }}
              />
              <ReviewItem
                label={copy.review.labels.targetRole}
                value={answers.targetRoleOrGoal}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(0);
                }}
              />
              <ReviewItem
                label={copy.review.labels.outputLanguage}
                value={copy.outputLanguageNames[answers.outputLanguage]}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(0);
                }}
              />
              <ReviewItem
                label={copy.review.labels.experience}
                value={answers.experience}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(1);
                }}
              />
              <ReviewItem
                label={copy.review.labels.education}
                value={answers.education}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(1);
                }}
              />
              <ReviewItem
                label={copy.review.labels.skills}
                value={answers.skillsAndTools}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(2);
                }}
              />
              <ReviewItem
                label={copy.review.labels.spokenLanguages}
                value={answers.spokenLanguages}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(2);
                }}
              />
              <ReviewItem
                label={copy.review.labels.additionalContext}
                value={answers.additionalContext}
                editLabel={copy.review.editButton}
                emptyLabel={copy.review.emptyValue}
                onEdit={() => {
                  setActiveStepIndex(3);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={isFirstStep || isGenerating}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copy.buttons.back}
        </button>
        {isLastStep ? (
          <button
            type="button"
            onClick={() => {
              void handleGenerate();
            }}
            disabled={isGenerating}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-emerald-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {isGenerating ? copy.buttons.building : status === "error" ? copy.buttons.tryAgain : copy.buttons.generate}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-emerald-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {activeStepIndex === STEP_KEYS.length - 2 ? copy.buttons.reviewAnswers : copy.buttons.next}
          </button>
        )}
      </div>
    </section>
  );
}

function getSparseWarnings(
  answers: CvQuestionnaireAnswers,
  warningsCopy: { experience: string; education: string; skills: string; spokenLanguages: string },
) {
  const warnings: string[] = [];

  if (!answers.experience.trim()) {
    warnings.push(warningsCopy.experience);
  }

  if (!answers.education.trim()) {
    warnings.push(warningsCopy.education);
  }

  if (!answers.skillsAndTools.trim()) {
    warnings.push(warningsCopy.skills);
  }

  if (!answers.spokenLanguages.trim()) {
    warnings.push(warningsCopy.spokenLanguages);
  }

  return warnings;
}

interface ReviewItemProps {
  label: string;
  value: string;
  editLabel: string;
  emptyLabel: string;
  onEdit: () => void;
}

function ReviewItem({ label, value, editLabel, emptyLabel, onEdit }: ReviewItemProps) {
  const hasValue = Boolean(value.trim());

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">{label}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline"
        >
          {editLabel}
        </button>
      </div>
      <p className={cn("mt-3 text-sm leading-6 whitespace-pre-wrap", hasValue ? "text-slate-700" : "text-slate-400")}>
        {hasValue ? value : emptyLabel}
      </p>
    </section>
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
