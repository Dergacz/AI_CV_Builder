import type { APIRoute } from "astro";
import { OBSERVABILITY_SMOKE_TOKEN } from "astro:env/server";

import { reportError, track, type Identity } from "@/lib/observability";
import { getAnonSessionId, getPseudonymousUserId } from "@/lib/observability/identity";

// F-01 proof-of-life smoke trigger. GUARD: this route is a no-op 404 unless
// `OBSERVABILITY_SMOKE_TOKEN` is set AND the request supplies a matching token
// (header `x-observability-smoke-token` or `?token=` query). It is therefore
// disabled by default — production never sets the secret, so anonymous/production
// traffic always gets a 404 and cannot fire it. Remove or keep the secret unset
// after F-01 verification (see README "PostHog Observability Configuration").
export const prerender = false;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Constant-time-ish token comparison so the guard does not leak length via timing. */
function tokensMatch(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

const handler: APIRoute = async (context) => {
  const expected = OBSERVABILITY_SMOKE_TOKEN?.trim();
  const provided =
    context.request.headers.get("x-observability-smoke-token")?.trim() ??
    context.url.searchParams.get("token")?.trim() ??
    "";

  // Fail closed: when the guard secret is absent (production default) or the token
  // does not match, behave exactly like a nonexistent route.
  if (!expected || !tokensMatch(expected, provided)) {
    return json(404, { ok: false, error: "not_found" });
  }

  const userId = context.locals.user?.id;
  const pseudonymousId = userId ? await getPseudonymousUserId(userId) : null;
  const identity: Identity = { distinctId: pseudonymousId ?? getAnonSessionId(context.cookies) };

  await track("observability_smoke", { surface: "server" }, identity);
  await reportError(new Error("smoke-test"), { error_location: "smoke" }, identity);

  return json(200, { ok: true });
};

export const GET = handler;
export const POST = handler;
