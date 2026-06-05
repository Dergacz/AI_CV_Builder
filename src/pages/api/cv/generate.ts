import type { APIRoute } from "astro";
import { z } from "zod";
import { OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { cvOutputLanguages } from "@/lib/cv-questionnaire";
import { generateCvDraft } from "@/lib/services/cv-generation";
import { generationErrorMessages, type GenerateDraftResponse } from "@/lib/cv-draft";

export const prerender = false;

const MAX_SHORT_FIELD = 300;
const MAX_LONG_FIELD = 5000;
const MAX_REQUEST_BODY_BYTES = 40_000;

// Server-only: kept out of `cv-questionnaire.ts` so zod is not bundled into the
// client questionnaire island. Output matches `CvQuestionnaireAnswers`.
const answersSchema = z.object({
  fullName: z.string().trim().min(1).max(MAX_SHORT_FIELD),
  targetRoleOrGoal: z.string().trim().min(1).max(MAX_LONG_FIELD),
  outputLanguage: z.enum(cvOutputLanguages),
  experience: z.string().max(MAX_LONG_FIELD).optional().default(""),
  education: z.string().max(MAX_LONG_FIELD).optional().default(""),
  skillsAndTools: z.string().max(MAX_LONG_FIELD).optional().default(""),
  spokenLanguages: z.string().max(MAX_LONG_FIELD).optional().default(""),
  additionalContext: z.string().max(MAX_LONG_FIELD).optional().default(""),
});

function json(status: number, body: GenerateDraftResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, {
      ok: false,
      error: "service_unavailable",
      message: "Your session has expired. Please sign in again.",
    });
  }

  const contentLength = Number(context.request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return json(413, { ok: false, error: "generation_failed", message: generationErrorMessages.generation_failed });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json(400, { ok: false, error: "generation_failed", message: generationErrorMessages.generation_failed });
  }

  const parsed = answersSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { ok: false, error: "generation_failed", message: generationErrorMessages.generation_failed });
  }

  if (!OPENAI_API_KEY) {
    return json(503, { ok: false, error: "service_unavailable", message: generationErrorMessages.service_unavailable });
  }

  const result = await generateCvDraft(parsed.data, { apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });
  const status = result.ok ? 200 : result.error === "service_unavailable" ? 503 : 422;
  return json(status, result);
};
