import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { cvSaveSchema } from "@/lib/cv-answers.schema";
import { cvSaveErrorMessages } from "@/lib/cv-save-messages";
import { createCv, listCvs } from "@/lib/services/cv-repository";
import type { ListCvsResponse, SaveCvResponse } from "@/types";

export const prerender = false;

// The save payload carries the full draft + questionnaire answers; allow generous
// headroom over the questionnaire-only generate route, but still bound it.
const MAX_REQUEST_BODY_BYTES = 100_000;

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

function json(status: number, body: ListCvsResponse | SaveCvResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/cv — list the authenticated user's saved CVs (content-free summaries). */
export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json(503, { ok: false, error: "service_unavailable", message: cvSaveErrorMessages.service_unavailable });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  try {
    const cvs = await listCvs(supabase, user.id);
    return json(200, { ok: true, cvs });
  } catch {
    return json(500, { ok: false, error: "load_failed", message: cvSaveErrorMessages.load_failed });
  }
};

/** POST /api/cv — create a new saved CV owned by the authenticated user. */
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  const contentLength = Number(context.request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return json(413, { ok: false, error: "save_failed", message: cvSaveErrorMessages.save_failed });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json(400, { ok: false, error: "save_failed", message: cvSaveErrorMessages.save_failed });
  }

  const parsed = cvSaveSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { ok: false, error: "save_failed", message: cvSaveErrorMessages.save_failed });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json(503, { ok: false, error: "service_unavailable", message: cvSaveErrorMessages.service_unavailable });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  try {
    const cv = await createCv(supabase, user.id, {
      title: parsed.data.title,
      draft: parsed.data.draft,
      answers: parsed.data.answers,
    });
    return json(201, { ok: true, cv });
  } catch {
    return json(500, { ok: false, error: "save_failed", message: cvSaveErrorMessages.save_failed });
  }
};
