import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signup-route funnel emission (S-01, plan phase 2).
 *
 * Locks that `funnel_signup_completed` fires on a successful registration (anonymous segment —
 * the anon-session identity), and not when signUp errors. Supabase + the observability contract
 * are mocked.
 */

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), track: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ auth: { signUp: mocks.signUp } }),
}));

vi.mock("@/lib/observability", () => ({ track: mocks.track }));

import { POST } from "@/pages/api/auth/signup";

function makeContext(form: Record<string, string>) {
  return {
    request: new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    }),
    cookies: {},
    locals: { locale: "en", observability: { distinctId: "anon-test" } },
    redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
  } as never;
}

beforeEach(() => {
  mocks.signUp.mockReset();
  mocks.track.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/signup — funnel emission", () => {
  it("emits funnel_signup_completed with the anon identity on success", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });

    const response = await POST(makeContext({ email: "ada@example.com", password: "pw-123456" }));

    expect(response.headers.get("Location")).toBe("/auth/confirm-email");
    expect(mocks.track).toHaveBeenCalledWith("funnel_signup_completed", { locale: "en" }, { distinctId: "anon-test" });
  });

  it("does not emit when signUp returns an error", async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: new Error("already registered") });

    const response = await POST(makeContext({ email: "ada@example.com", password: "pw-123456" }));

    expect(response.headers.get("Location")).toContain("/auth/signup?error=");
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
