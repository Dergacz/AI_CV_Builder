import type { APIRoute } from "astro";
import { OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { track } from "@/lib/observability";
import { scheduleErrorReport } from "@/lib/observability/schedule";
import { generateCvDraft } from "@/lib/services/cv-generation";
import {
  checkGenerationQuota,
  getGenerationLimits,
  recordGeneration,
  type QuotaVerdict,
} from "@/lib/services/generation-quota";
import { createClient } from "@/lib/supabase";
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

  // Abuse guards (FR-012). Deliberately placed after schema validation — so a malformed request
  // costs no DB round-trip — but BEFORE the provider-key check and the LLM call, so a refused user
  // costs nothing and the refusal never depends on provider configuration.
  const supabase = createClient(context.request.headers, context.cookies);
  const limits = getGenerationLimits();

  if (supabase) {
    let verdict: QuotaVerdict = "ok";
    try {
      verdict = await checkGenerationQuota(supabase, limits);
    } catch (error) {
      // Fail open. This is abuse protection, not a paywall: a counter outage must never take down
      // the core feature. Reported so a sustained unmetered window does not pass unnoticed —
      // scheduled off the response path so a slow PostHog cannot compound a Supabase fault.
      scheduleErrorReport(error, { error_location: "api/cv/generate:checkGenerationQuota" }, context.locals);
    }

    if (verdict !== "ok") {
      await track(
        "generation_limit_reached",
        { limit_kind: verdict, locale: context.locals.locale },
        context.locals.observability,
      );

      // Only the per-user wall is named. The aggregate guard reuses service_unavailable so it stays
      // indistinguishable from an ordinary outage — accurate for the user, and it does not confirm
      // to an attacker that they found the product-wide ceiling.
      return verdict === "user_daily"
        ? json(429, {
            ok: false,
            error: "daily_limit_reached",
            message: generationErrorMessages.daily_limit_reached,
          })
        : json(503, {
            ok: false,
            error: "service_unavailable",
            message: generationErrorMessages.service_unavailable,
          });
    }
  }

  if (!OPENAI_API_KEY) {
    return json(503, { ok: false, error: "service_unavailable", message: generationErrorMessages.service_unavailable });
  }

  const startedAt = Date.now();
  const result = await generateCvDraft(parsed.data, {
    apiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL,
    // S-07: the service reports the specific cause; the route only supplies identity and the
    // scheduler. Deliberately no second report on the `!result.ok` branch below — the cause is
    // already recorded, and double-reporting would make failure rates meaningless.
    reportFailure: (error, location, props) => {
      scheduleErrorReport(error, { error_location: location, ...props }, context.locals);
    },
  });
  const status = result.ok ? 200 : result.error === "service_unavailable" ? 503 : 422;

  if (!result.ok) {
    return json(status, result);
  }

  const generationEventId = crypto.randomUUID();

  // Only successful generations count against the quota — a user is never charged for our own
  // failures. `record_generation` re-checks the daily cap itself, so a `false` return just means a
  // concurrent request already claimed the last slot; either way the draft below is returned.
  if (supabase) {
    try {
      await recordGeneration(supabase, limits);
    } catch (error) {
      // Bookkeeping failure must not destroy work the user already waited for — so the report is
      // scheduled, never awaited: the draft is already in hand and owes nothing to PostHog.
      scheduleErrorReport(error, { error_location: "api/cv/generate:recordGeneration" }, context.locals);
    }
  }

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
