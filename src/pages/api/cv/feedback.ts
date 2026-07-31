import type { APIRoute } from "astro";
import { track } from "@/lib/observability";
import { createClient, safeGetUser } from "@/lib/supabase";
import { feedbackSchema } from "@/lib/feedback.schema";
import { readBoundedJson } from "@/lib/request-body";
import { upsertFeedback } from "@/lib/services/feedback-repository";
import type { SubmitFeedbackResponse } from "@/types";

export const prerender = false;

const MAX_REQUEST_BODY_BYTES = 4_000;

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";
const FEEDBACK_FAILED = "Failed to save feedback. Please try again.";
const SERVICE_UNAVAILABLE = "Service temporarily unavailable. Please try again.";

function json(status: number, body: SubmitFeedbackResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** POST /api/cv/feedback — upsert a feedback verdict for a generation event. */
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  const body = await readBoundedJson(context.request, MAX_REQUEST_BODY_BYTES);
  if (!body.ok) {
    return json(body.status === 413 ? 413 : 400, {
      ok: false,
      error: "feedback_failed",
      message: FEEDBACK_FAILED,
    });
  }

  const parsed = feedbackSchema.safeParse(body.body);
  if (!parsed.success) {
    return json(400, { ok: false, error: "feedback_failed", message: FEEDBACK_FAILED });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json(503, { ok: false, error: "service_unavailable", message: SERVICE_UNAVAILABLE });
  }

  const user = await safeGetUser(supabase);
  if (!user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  try {
    await upsertFeedback(supabase, user.id, {
      generationEventId: parsed.data.generationEventId,
      helpful: parsed.data.helpful,
      comment: parsed.data.comment,
    });
  } catch {
    return json(500, { ok: false, error: "feedback_failed", message: FEEDBACK_FAILED });
  }

  // Privacy (F-01): comment is never forwarded to PostHog.
  await track(
    "feedback_submitted",
    {
      helpful: parsed.data.helpful,
      locale: context.locals.locale,
      generation_event_id: parsed.data.generationEventId,
    },
    context.locals.observability,
  );

  return json(200, { ok: true });
};
