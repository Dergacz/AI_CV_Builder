import { describe, expect, it, vi } from "vitest";

import { POST } from "@/pages/api/cv/generate";

/**
 * Body-size guard for `/api/cv/generate`.
 *
 * The route used to trust the `Content-Length` header, so a chunked request that omits
 * it reached `request.json()` unbounded. `readBoundedJson` measures the decoded body
 * instead — this is the generate-route twin of the save-route test in `cv-index.test.ts`.
 */

// `astro:env/server` is a virtual module the Astro build injects; vitest resolves it
// through the alias in vitest.config.ts, and this mock supplies the values.
vi.mock("astro:env/server", () => ({ OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-4o-mini" }));

vi.mock("@/lib/services/cv-generation", () => ({
  generateCvDraft: vi.fn(),
}));

const MAX_REQUEST_BODY_BYTES = 40_000;

function context(request: Request, signedIn = true) {
  return { locals: { user: signedIn ? { id: "user-123" } : null }, request } as never;
}

function oversizedRequest(): Request {
  const request = new Request("http://localhost/api/cv/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ additionalContext: "x".repeat(MAX_REQUEST_BODY_BYTES + 1) }),
  });
  request.headers.delete("content-length");
  return request;
}

describe("POST /api/cv/generate", () => {
  it("rejects an oversized body even when Content-Length is absent", async () => {
    const response = await POST(context(oversizedRequest()));

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ ok: false, error: "generation_failed" });
  });

  it("rejects a body that is not valid JSON", async () => {
    const request = new Request("http://localhost/api/cv/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });

    expect((await POST(context(request))).status).toBe(400);
  });

  it("refuses an unauthenticated request before reading the body", async () => {
    expect((await POST(context(oversizedRequest(), false))).status).toBe(401);
  });
});
