import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient, safeGetUser } from "@/lib/supabase";
import { cvSaveSchema } from "@/lib/cv-answers.schema";
import { cvSaveErrorMessages } from "@/lib/cv-save-messages";
import { readBoundedJson } from "@/lib/request-body";
import { deleteCv, getCv, updateCv } from "@/lib/services/cv-repository";
import type { DeleteCvResponse, GetCvResponse, SaveCvResponse } from "@/types";

export const prerender = false;

const MAX_REQUEST_BODY_BYTES = 100_000;

const SESSION_EXPIRED = "Your session has expired. Please sign in again.";

const idSchema = z.uuid();

type ItemResponse = GetCvResponse | SaveCvResponse | DeleteCvResponse;

function json(status: number, body: ItemResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** GET /api/cv/[id] — load one owned CV in full. 404 when missing / not owned. */
export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }
  const id = idSchema.safeParse(context.params.id);
  if (!id.success) {
    return json(404, { ok: false, error: "not_found", message: cvSaveErrorMessages.not_found });
  }
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json(503, { ok: false, error: "service_unavailable", message: cvSaveErrorMessages.service_unavailable });
  }
  const user = await safeGetUser(supabase);
  if (!user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  try {
    const cv = await getCv(supabase, user.id, id.data);
    if (!cv) {
      return json(404, { ok: false, error: "not_found", message: cvSaveErrorMessages.not_found });
    }
    return json(200, { ok: true, cv });
  } catch {
    return json(500, { ok: false, error: "load_failed", message: cvSaveErrorMessages.load_failed });
  }
};

/** PUT /api/cv/[id] — overwrite an owned CV's draft/snapshot/title. */
export const PUT: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }
  const id = idSchema.safeParse(context.params.id);
  if (!id.success) {
    return json(404, { ok: false, error: "not_found", message: cvSaveErrorMessages.not_found });
  }

  const body = await readBoundedJson(context.request, MAX_REQUEST_BODY_BYTES);
  if (!body.ok) {
    return json(body.status, { ok: false, error: "save_failed", message: cvSaveErrorMessages.save_failed });
  }

  const parsed = cvSaveSchema.safeParse(body.body);
  if (!parsed.success) {
    return json(400, { ok: false, error: "save_failed", message: cvSaveErrorMessages.save_failed });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json(503, { ok: false, error: "service_unavailable", message: cvSaveErrorMessages.service_unavailable });
  }
  const user = await safeGetUser(supabase);
  if (!user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  try {
    const cv = await updateCv(supabase, user.id, id.data, {
      title: parsed.data.title,
      draft: parsed.data.draft,
      answers: parsed.data.answers,
    });
    if (!cv) {
      return json(404, { ok: false, error: "not_found", message: cvSaveErrorMessages.not_found });
    }
    return json(200, { ok: true, cv });
  } catch {
    return json(500, { ok: false, error: "save_failed", message: cvSaveErrorMessages.save_failed });
  }
};

/** DELETE /api/cv/[id] — hard-delete an owned CV. */
export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }
  const id = idSchema.safeParse(context.params.id);
  if (!id.success) {
    return json(404, { ok: false, error: "not_found", message: cvSaveErrorMessages.not_found });
  }
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return json(503, { ok: false, error: "service_unavailable", message: cvSaveErrorMessages.service_unavailable });
  }
  const user = await safeGetUser(supabase);
  if (!user) {
    return json(401, { ok: false, error: "service_unavailable", message: SESSION_EXPIRED });
  }

  try {
    const deleted = await deleteCv(supabase, user.id, id.data);
    if (!deleted) {
      return json(404, { ok: false, error: "not_found", message: cvSaveErrorMessages.not_found });
    }
    return json(200, { ok: true });
  } catch {
    return json(500, { ok: false, error: "delete_failed", message: cvSaveErrorMessages.delete_failed });
  }
};
