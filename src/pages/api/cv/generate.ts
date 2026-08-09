import type { APIRoute } from "astro";
import { OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { generateCvDraft } from "@/lib/services/cv-generation";
import { generationErrorMessages, type GenerateDraftResponse } from "@/lib/cv-draft";
import { cvAnswersSchema } from "@/lib/cv-answers.schema";
import { readBoundedJson } from "@/lib/request-body";

export const prerender = false;

const MAX_REQUEST_BODY_BYTES = 40_000;

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

  // Measure the decoded body rather than trusting Content-Length: a chunked request can
  // omit the header entirely and slip past a header-only check.
  const body = await readBoundedJson(context.request, MAX_REQUEST_BODY_BYTES);
  if (!body.ok) {
    return json(body.status, {
      ok: false,
      error: "generation_failed",
      message: generationErrorMessages.generation_failed,
    });
  }

  const parsed = cvAnswersSchema.safeParse(body.body);
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
