import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resend: vi.fn(), createClient: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "@/pages/api/auth/resend";

function makeContext(form: Record<string, string>) {
  return {
    request: new Request("http://localhost/api/auth/resend", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    }),
    cookies: {},
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  } as never;
}

beforeEach(() => {
  mocks.resend.mockReset();
  mocks.createClient.mockReturnValue({ auth: { resend: mocks.resend } });
});

describe("POST /api/auth/resend", () => {
  it("resends signup confirmation emails and returns to confirm-email with a sent notice", async () => {
    mocks.resend.mockResolvedValue({ data: { user: null, session: null }, error: null });

    const response = await POST(makeContext({ email: "ada+verify@example.com" }));

    expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: "ada+verify@example.com" });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/confirm-email?email=ada%2Bverify%40example.com&status=sent");
  });

  it("redirects with an error notice when resend fails", async () => {
    mocks.resend.mockResolvedValue({ data: null, error: { status: 400, code: "bad_email" } });

    const response = await POST(makeContext({ email: "ada@example.com" }));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/confirm-email?email=ada%40example.com&status=error");
  });

  it("preserves the rate-limited error code when Supabase rate-limits resend", async () => {
    mocks.resend.mockResolvedValue({ data: null, error: { status: 429, code: "over_email_send_rate_limit" } });

    const response = await POST(makeContext({ email: "ada@example.com" }));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/confirm-email?email=ada%40example.com&error=rate_limited");
  });
});
