import { describe, expect, it, vi } from "vitest";

import { POST } from "@/pages/api/cv/index";

vi.mock("@/lib/supabase", () => ({
  createClient: () => null,
}));

describe("POST /api/cv body size guard", () => {
  it("rejects an oversized body even when Content-Length is absent", async () => {
    const oversizedBody = JSON.stringify({ payload: "x".repeat(100_001) });
    const request = new Request("http://localhost/api/cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversizedBody,
    });
    request.headers.delete("content-length");

    const response = await POST({
      locals: { user: { id: "user-123" } },
      request,
    } as never);

    expect(response.status).toBe(413);
  });
});
