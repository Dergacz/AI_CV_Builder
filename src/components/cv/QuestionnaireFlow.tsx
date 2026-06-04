import { useMemo, useState } from "react";
import {
  QUESTIONNAIRE_VERSION,
  cvOutputLanguages,
  defaultCvQuestionnaireAnswers,
  type CvOutputLanguage,
  type CvQuestionnaireAnswers,
} from "@/lib/cv-questionnaire";
import { cn } from "@/lib/utils";

type StepKey = "basics" | "experienceEducation" | "skillsLanguages" | "extraContext" | "review";
type RequiredErrors = Partial<Record<"fullName" | "targetRoleOrGoal", string>>;

const steps: { key: StepKey; label: string; title: string; body: string }[] = [
  {
    key: "basics",
    label: "Basics",
    title: "Start with the essentials",
    body: "Add only the anchors the future draft needs before everything else stays optional.",
  },
  {
    key: "experienceEducation",
    label: "Experience",
    title: "Describe what you have done",
    body: "Use everyday language. Informal, volunteer, school, or early work experience all count.",
  },
  {
    key: "skillsLanguages",
    label: "Skills",
    title: "List skills, tools, and languages",
    body: "Share practical abilities and spoken languages without worrying about CV formatting.",
  },
  {
    key: "extraContext",
    label: "Context",
    title: "Add anything useful",
    body: "Include details that did not fit elsewhere. The review step comes next.",
  },
  {
    key: "review",
    label: "Review",
    title: "Review your answers",
    body: "Check what you provided. Draft generation comes in the next roadmap slice.",
  },
];

const outputLanguageLabels: Record<CvOutputLanguage, string> = {
  en: "English",
  pl: "Polish",
  ru: "Russian",
};

function isRequiredField(field: keyof CvQuestionnaireAnswers): field is keyof RequiredErrors {
  return field === "fullName" || field === "targetRoleOrGoal";
}

export default function QuestionnaireFlow() {
  const [answers, setAnswers] = useState<CvQuestionnaireAnswers>(defaultCvQuestionnaireAnswers);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [errors, setErrors] = useState<RequiredErrors>({});

  const activeStep = steps[activeStepIndex];
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === steps.length - 1;
  const sparseWarnings = useMemo(() => getSparseWarnings(answers), [answers]);

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
      nextErrors.fullName = "Enter your name so the CV draft has a clear identity.";
    }

    if (!answers.targetRoleOrGoal.trim()) {
      nextErrors.targetRoleOrGoal = "Add a role, direction, or goal so the draft knows what to aim for.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goNext() {
    if (activeStep.key === "basics" && !validateBasics()) return;
    if (isLastStep) return;
    setActiveStepIndex((current) => current + 1);
  }

  function goBack() {
    if (isFirstStep) return;
    setActiveStepIndex((current) => current - 1);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="CV questionnaire">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-700">Questionnaire {QUESTIONNAIRE_VERSION}</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">{activeStep.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{activeStep.body}</p>
        </div>
        <p className="text-sm font-medium text-slate-500">
          Step {activeStepIndex + 1} of {steps.length}
        </p>
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-4" aria-label="Questionnaire progress">
        {steps.map((step, index) => (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => {
                if (activeStep.key === "basics" && index > activeStepIndex && !validateBasics()) return;
                setActiveStepIndex(index);
              }}
              className={cn(
                "min-h-11 w-full rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors",
                index === activeStepIndex
                  ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              {step.label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 min-h-[28rem]">
        {activeStep.key === "basics" && (
          <div className="space-y-5">
            <TextField
              id="fullName"
              label="What name should appear on your CV?"
              value={answers.fullName}
              onChange={(value) => {
                updateAnswer("fullName", value);
              }}
              placeholder="e.g. Anna Kowalska"
              error={errors.fullName}
            />
            <TextAreaField
              id="targetRoleOrGoal"
              label="What role, job, or direction are you aiming for?"
              value={answers.targetRoleOrGoal}
              onChange={(value) => {
                updateAnswer("targetRoleOrGoal", value);
              }}
              placeholder="e.g. I want an entry-level customer support role where I can use English and help people."
              error={errors.targetRoleOrGoal}
            />
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">CV output language</legend>
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
                    {outputLanguageLabels[language]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {activeStep.key === "experienceEducation" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <TextAreaField
              id="experience"
              label="What work, volunteering, projects, or responsibilities have you had?"
              value={answers.experience}
              onChange={(value) => {
                updateAnswer("experience", value);
              }}
              placeholder="Write short notes. Dates, places, and exact job titles are optional."
            />
            <TextAreaField
              id="education"
              label="What education, courses, certificates, or training should be included?"
              value={answers.education}
              onChange={(value) => {
                updateAnswer("education", value);
              }}
              placeholder="Mention schools, programs, courses, certificates, or what you studied."
            />
          </div>
        )}

        {activeStep.key === "skillsLanguages" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <TextAreaField
              id="skillsAndTools"
              label="What skills, tools, or strengths should the CV mention?"
              value={answers.skillsAndTools}
              onChange={(value) => {
                updateAnswer("skillsAndTools", value);
              }}
              placeholder="e.g. customer communication, spreadsheets, Canva, teamwork, organizing tasks."
            />
            <TextAreaField
              id="spokenLanguages"
              label="Which languages do you know?"
              value={answers.spokenLanguages}
              onChange={(value) => {
                updateAnswer("spokenLanguages", value);
              }}
              placeholder="e.g. Polish native, English B1/B2, Russian conversational."
            />
          </div>
        )}

        {activeStep.key === "extraContext" && (
          <div className="space-y-5">
            <TextAreaField
              id="additionalContext"
              label="Anything else we should know before creating your draft?"
              value={answers.additionalContext}
              onChange={(value) => {
                updateAnswer("additionalContext", value);
              }}
              placeholder="Add preferences, achievements, constraints, career change context, or anything that feels relevant."
            />
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              Next, you will review these answers. They stay only in this page while you move between steps.
            </div>
          </div>
        )}

        {activeStep.key === "review" && (
          <div className="space-y-6">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              Your answers are captured for review. The next roadmap slice will use this shape to generate a draft; this
              screen does not create, save, or export a CV yet.
            </div>

            {sparseWarnings.length > 0 && (
              <section className="rounded-md border border-amber-200 bg-amber-50 p-4" aria-label="Sparse answer notes">
                <h3 className="text-sm font-semibold text-amber-950">Before generation, keep in mind</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                  {sparseWarnings.map((warning) => (
                    <li key={warning}>- {warning}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <ReviewItem
                label="Name"
                value={answers.fullName}
                onEdit={() => {
                  setActiveStepIndex(0);
                }}
              />
              <ReviewItem
                label="Target role or goal"
                value={answers.targetRoleOrGoal}
                onEdit={() => {
                  setActiveStepIndex(0);
                }}
              />
              <ReviewItem
                label="CV output language"
                value={outputLanguageLabels[answers.outputLanguage]}
                onEdit={() => {
                  setActiveStepIndex(0);
                }}
              />
              <ReviewItem
                label="Experience"
                value={answers.experience}
                onEdit={() => {
                  setActiveStepIndex(1);
                }}
              />
              <ReviewItem
                label="Education"
                value={answers.education}
                onEdit={() => {
                  setActiveStepIndex(1);
                }}
              />
              <ReviewItem
                label="Skills and tools"
                value={answers.skillsAndTools}
                onEdit={() => {
                  setActiveStepIndex(2);
                }}
              />
              <ReviewItem
                label="Spoken languages"
                value={answers.spokenLanguages}
                onEdit={() => {
                  setActiveStepIndex(2);
                }}
              />
              <ReviewItem
                label="Additional context"
                value={answers.additionalContext}
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
          disabled={isFirstStep}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={isLastStep}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-emerald-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {isLastStep ? "Generation comes next" : activeStepIndex === steps.length - 2 ? "Review answers" : "Next"}
        </button>
      </div>
    </section>
  );
}

function getSparseWarnings(answers: CvQuestionnaireAnswers) {
  const warnings: string[] = [];

  if (!answers.experience.trim()) {
    warnings.push(
      "Experience is empty, so the future draft may keep that section conservative or ask you to review it.",
    );
  }

  if (!answers.education.trim()) {
    warnings.push("Education is empty; the future draft should not invent schools, courses, or dates.");
  }

  if (!answers.skillsAndTools.trim()) {
    warnings.push("Skills and tools are empty, so the future draft may have fewer concrete strengths to work with.");
  }

  if (!answers.spokenLanguages.trim()) {
    warnings.push(
      "Spoken languages are empty; the selected CV output language will not be treated as a claimed skill.",
    );
  }

  return warnings;
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}

function TextField({ id, label, value, onChange, placeholder, error }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className={cn(
          "mt-2 w-full rounded-md border bg-white px-3 py-2 text-slate-950 placeholder-slate-400 transition-colors focus:ring-2 focus:outline-none",
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-slate-300 focus:border-emerald-700 focus:ring-emerald-100",
        )}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function TextAreaField({ id, label, value, onChange, placeholder, error }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        rows={6}
        className={cn(
          "mt-2 w-full resize-y rounded-md border bg-white px-3 py-2 text-slate-950 placeholder-slate-400 transition-colors focus:ring-2 focus:outline-none",
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-slate-300 focus:border-emerald-700 focus:ring-emerald-100",
        )}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface ReviewItemProps {
  label: string;
  value: string;
  onEdit: () => void;
}

function ReviewItem({ label, value, onEdit }: ReviewItemProps) {
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
          Edit
        </button>
      </div>
      <p className={cn("mt-3 text-sm leading-6 whitespace-pre-wrap", hasValue ? "text-slate-700" : "text-slate-400")}>
        {hasValue ? value : "Skipped for now"}
      </p>
    </section>
  );
}
