import { QUESTIONNAIRE_VERSION, type CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import { generatedCvDraftSchema, generationErrorMessages, type GenerateDraftServiceResult } from "@/lib/cv-draft";
import type { GenerationErrorLocation } from "@/lib/observability/locations";

/**
 * CV generation service.
 *
 * Turns guided-questionnaire answers into a validated `GeneratedCvDraft` by calling
 * OpenAI with strict structured outputs, then validating the result with zod
 * (defense-in-depth). The model only produces `sections`/`assumptions`/`warnings`;
 * `schemaVersion`, `language`, and `source` are stamped here so they are always correct.
 *
 * Privacy (F-02 / S-07): this module must never log raw answers, the prompt, the raw model
 * response, or any draft content. Failures are surfaced via error buckets — and, since S-07,
 * also via an OPTIONAL injected reporter that receives a failure *location* and nothing
 * content-bearing. The reporter is injected rather than imported so this module stays pure:
 * no observability dependency, no `astro:env/server`, no mock needed in its own tests.
 *
 * Runtime: uses `fetch` so it runs on the Cloudflare Workers runtime; no Node-only SDK.
 */

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const GENERATION_TIMEOUT_MS = 25_000;
const MODEL_PROVIDER = "openai";

/**
 * Strict JSON schema for the model's output. OpenAI strict mode requires every
 * property to be listed in `required` and `additionalProperties: false`; "optional"
 * fields are expressed as nullable types and nulls are stripped before validation.
 * `minItems`/`minLength` are intentionally absent — strict mode rejects them.
 */
const nullableString = { type: ["string", "null"] } as const;

const DRAFT_CONTENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sections", "assumptions", "warnings"],
  properties: {
    sections: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "experience", "education", "skills", "languages"],
      properties: {
        summary: {
          type: "object",
          additionalProperties: false,
          required: ["headline", "body"],
          properties: { headline: nullableString, body: { type: "string" } },
        },
        experience: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "role",
              "organization",
              "location",
              "startDate",
              "endDate",
              "isCurrent",
              "description",
              "highlights",
            ],
            properties: {
              role: nullableString,
              organization: nullableString,
              location: nullableString,
              startDate: nullableString,
              endDate: nullableString,
              isCurrent: { type: ["boolean", "null"] },
              description: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
            },
          },
        },
        education: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["institution", "program", "location", "startDate", "endDate", "description"],
            properties: {
              institution: nullableString,
              program: nullableString,
              location: nullableString,
              startDate: nullableString,
              endDate: nullableString,
              description: nullableString,
            },
          },
        },
        skills: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "items"],
            properties: {
              label: { type: "string" },
              items: { type: "array", items: { type: "string" } },
            },
          },
        },
        languages: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "proficiency"],
            properties: { name: { type: "string" }, proficiency: nullableString },
          },
        },
      },
    },
    assumptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "reason"],
        properties: { field: { type: "string" }, reason: { type: "string" } },
      },
    },
    warnings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "minimal_input",
              "missing_experience",
              "missing_education",
              "missing_skills",
              "missing_languages",
              "low_confidence",
            ],
          },
          message: { type: "string" },
        },
      },
    },
  },
} as const;

const languageNames: Record<CvQuestionnaireAnswers["outputLanguage"], string> = {
  en: "English",
  pl: "Polish",
  ru: "Russian",
};

const SYSTEM_PROMPT = [
  "You are an expert CV writer helping a first-time or low-confidence job seeker turn plain, everyday answers into a professional, structured CV draft.",
  "",
  "Hard rules (never break these):",
  "- Use ONLY facts the user supplied. Never invent employers, schools, roles, job titles, dates, employment status, locations, achievements, metrics, certifications, or language proficiency.",
  "- Prefer empty arrays plus a warning over fabricating a section entry. If experience/education/skills/languages are not supported by the answers, return an empty array for that section and add the matching warning code.",
  "- You may rephrase informal wording into professional language and group skills into simple categories, but do not add information the user did not provide.",
  "- The selected CV output language is not automatically a language the user speaks — only include it under languages if the answers support it.",
  "- If input is thin, keep the summary short and conservative and add 'minimal_input' and/or 'low_confidence' warnings.",
  "- Use the 'assumptions' array to record non-factual editorial choices (ordering, phrasing, grouping).",
  "- Every skill group you include must contain at least one skill item.",
  "",
  "Write ALL CV content (summary, experience, education, skills, languages, assumption reasons, and warning messages) in the requested output language.",
].join("\n");

function buildUserPrompt(answers: CvQuestionnaireAnswers): string {
  const language = languageNames[answers.outputLanguage];
  const field = (label: string, value: string) => `${label}: ${value.trim() ? value.trim() : "(not provided)"}`;
  return [
    `Output language: ${language}.`,
    "",
    "Here are the user's answers from the guided questionnaire:",
    field("Full name", answers.fullName),
    field("Target role or goal", answers.targetRoleOrGoal),
    field("Experience (work, volunteering, projects, responsibilities)", answers.experience),
    field("Education (schools, courses, certificates, training)", answers.education),
    field("Skills and tools", answers.skillsAndTools),
    field("Spoken languages", answers.spokenLanguages),
    field("Additional context", answers.additionalContext),
    "",
    "Produce the structured CV draft content (sections, assumptions, warnings) following the rules.",
  ].join("\n");
}

/** Recursively drop null-valued keys so zod's `.optional()` fields validate cleanly. */
function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) => stripNulls(item));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val === null) continue;
      result[key] = stripNulls(val);
    }
    return result;
  }
  return value;
}

function genFailed(): GenerateDraftServiceResult {
  return { ok: false, error: "generation_failed", message: generationErrorMessages.generation_failed };
}

function unavailable(): GenerateDraftServiceResult {
  return { ok: false, error: "service_unavailable", message: generationErrorMessages.service_unavailable };
}

/**
 * Reports one generation failure mode. Receives the caught value where one exists (`undefined`
 * for the modes that fail without throwing) and the location that identifies the mode.
 *
 * `status` is the provider's HTTP status on the non-ok path — an allowlisted, content-free field,
 * and the one that separates "rate-limited" (429) from "outage" (5xx) from "bad key" (401). That
 * distinction is the whole reason these modes are reported separately.
 *
 * Must never throw: generation is not allowed to fail because reporting did.
 */
export type GenerationFailureReporter = (
  error: unknown,
  location: GenerationErrorLocation,
  props?: { status?: number },
) => void;

export async function generateCvDraft(
  answers: CvQuestionnaireAnswers,
  config: { apiKey: string; model?: string; reportFailure?: GenerationFailureReporter },
): Promise<GenerateDraftServiceResult> {
  // Deliberately unreported: an absent key is a configuration state, not a runtime failure, and
  // the route already refuses with `service_unavailable` before ever calling us.
  if (!config.apiKey) {
    return unavailable();
  }
  const report: GenerationFailureReporter = config.reportFailure ?? (() => undefined);
  const trimmedModel = config.model?.trim();
  const model = trimmedModel && trimmedModel.length > 0 ? trimmedModel : DEFAULT_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, GENERATION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(answers) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "generated_cv_draft", strict: true, schema: DRAFT_CONTENT_JSON_SCHEMA },
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    // Network error or timeout/abort — temporary, not the user's fault.
    report(error, "services/cv-generation:providerFetch");
    return unavailable();
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Provider/integration error — temporary from the user's perspective. The status is what
    // makes this actionable: 429 means back off, 401 means the key is wrong, 5xx means wait.
    report(undefined, "services/cv-generation:providerResponse", { status: response.status });
    return unavailable();
  }

  let content: string | undefined;
  let refused = false;
  try {
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string; refusal?: string | null } }[];
    };
    const message = payload.choices?.[0]?.message;
    if (message?.refusal) {
      // The refusal TEXT is model output about the user's answers — it never leaves. Only the
      // fact of a refusal does. Flagged here and reported outside the try so a refusal is never
      // misattributed to the response-parse catch below.
      refused = true;
    } else {
      content = message?.content ?? undefined;
    }
  } catch (error) {
    report(error, "services/cv-generation:responseParse");
    return unavailable();
  }

  if (refused) {
    report(undefined, "services/cv-generation:modelRefusal");
    return genFailed();
  }

  if (!content) {
    report(undefined, "services/cv-generation:emptyContent");
    return genFailed();
  }

  let rawContent: unknown;
  try {
    rawContent = stripNulls(JSON.parse(content));
  } catch (error) {
    report(error, "services/cv-generation:contentParse");
    return genFailed();
  }

  const draft = {
    ...(rawContent as object),
    schemaVersion: 1 as const,
    language: answers.outputLanguage,
    source: {
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      generatedAt: new Date().toISOString(),
      modelProvider: MODEL_PROVIDER,
      modelName: model,
    },
  };

  const parsed = generatedCvDraftSchema.safeParse(draft);
  if (!parsed.success) {
    // Model output did not conform to the contract; surface as a retryable generation failure.
    // The zod issue list names draft fields and would carry content — it is deliberately not sent.
    report(undefined, "services/cv-generation:schemaMismatch");
    return genFailed();
  }

  return { ok: true, draft: parsed.data };
}
