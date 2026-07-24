import type { APIRoute } from "astro";
import { OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { track } from "@/lib/observability";
import { generateCvDraft } from "@/lib/services/cv-generation";
import { generationErrorMessages, type GenerateDraftResponse } from "@/lib/cv-draft";
import { cvAnswersSchema } from "@/lib/cv-answers.schema";

const MODEL_PROVIDER = "openai";

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

  const parsed = cvAnswersSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { ok: false, error: "generation_failed", message: generationErrorMessages.generation_failed });
  }

  if (!OPENAI_API_KEY) {
    return json(503, { ok: false, error: "service_unavailable", message: generationErrorMessages.service_unavailable });
  }

  const startedAt = Date.now();
  const result = await generateCvDraft(parsed.data, { apiKey: OPENAI_API_KEY, model: OPENAI_MODEL });
  const status = result.ok ? 200 : result.error === "service_unavailable" ? 503 : 422;

  if (!result.ok) {
    return json(status, result);
  }

  const generationEventId = crypto.randomUUID();

  // Funnel step 6: emit only on a successful generation. Failures show as drop-off (absence of the
  // next step); their cause is covered by S-07 error monitoring, not this event.
  await track(
    "funnel_cv_generated",
    {
      locale: context.locals.locale,
      model_provider: MODEL_PROVIDER,
      duration_ms: Date.now() - startedAt,
      success: true,
      generation_event_id: generationEventId,
    },
    context.locals.observability,
  );

  return json(200, { ok: true, draft: result.draft, generationEventId });
};
