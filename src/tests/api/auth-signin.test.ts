import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), createClient: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "@/pages/api/auth/signin";

function makeContext(form: Record<string, string>) {
  return {
    request: new Request("http://localhost/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    }),
    cookies: {},
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  } as never;
}

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
  mocks.createClient.mockReturnValue({ auth: { signInWithPassword: mocks.signInWithPassword } });
});

describe("POST /api/auth/signin", () => {
  it("threads email and the dedicated error code when signin fails for an unconfirmed email", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { status: 400, code: "email_not_confirmed", message: "Email not confirmed" },
    });

    const response = await POST(makeContext({ email: "ada+verify@example.com", password: "Test-Email-Verify-123!" }));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/auth/signin?error=email_not_confirmed&email=ada%2Bverify%40example.com",
    );
  });
});
