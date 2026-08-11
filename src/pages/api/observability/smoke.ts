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

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

/**
 * Constant-time token comparison. Both inputs are hashed to fixed-width 32-byte digests first, so
 * neither the length nor the content of the secret leaks through comparison timing.
 */
async function tokensMatch(expected: string, provided: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(expected), sha256(provided)]);
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a[i] ^ b[i];
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
  if (!expected || !(await tokensMatch(expected, provided))) {
    return json(404, { ok: false, error: "not_found" });
  }

  const userId = context.locals.user?.id;
  const pseudonymousId = userId ? await getPseudonymousUserId(userId) : null;
  const identity: Identity = { distinctId: pseudonymousId ?? getAnonSessionId(context.cookies) };

  // Fire both emits concurrently so the worst-case added latency stays at one timeout, not two.
  await Promise.all([
    track("observability_smoke", { surface: "server" }, identity),
    reportError(new Error("smoke-test"), { error_location: "api/observability/smoke:smoke" }, identity),
  ]);

  return json(200, { ok: true });
};

export const GET = handler;
export const POST = handler;
