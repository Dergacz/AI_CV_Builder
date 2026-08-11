import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signup-route funnel emission (S-01, plan phase 2) and confirmation-link destination (S-10, R-16).
 *
 * Locks that `funnel_signup_completed` fires on a successful registration (anonymous segment —
 * the anon-session identity), and not when signUp errors. Supabase + the observability contract
 * are mocked.
 *
 * Also locks that the signup call carries an `emailRedirectTo` built from the *request* origin.
 * Without it GoTrue falls back to the project's `Site URL`, which is what pointed every production
 * confirmation email at localhost. The origin is asserted against a non-localhost host so a
 * hard-coded destination cannot pass.
 */

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), track: vi.fn() }));

interface SignUpPayload {
  email: string;
  password: string;
  options: {
    emailRedirectTo: string;
    data: {
      consent_version: string;
      consent_accepted_at: string;
    };
  };
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ auth: { signUp: mocks.signUp } }),
}));

vi.mock("@/lib/observability", () => ({ track: mocks.track }));

import { POST } from "@/pages/api/auth/signup";
import { POLICY_VERSION } from "@/lib/legal/policy";

function makeContext(form: Record<string, string>, origin = "http://localhost") {
  return {
    url: new URL(`${origin}/api/auth/signup`),
    request: new Request(`${origin}/api/auth/signup`, {
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

    const response = await POST(makeContext({ email: "ada@example.com", password: "pw-123456", consent: "on" }));

    expect(response.headers.get("Location")).toBe("/auth/confirm-email?email=ada%40example.com");
    const [signUpPayload] = mocks.signUp.mock.calls[0] as [SignUpPayload];
    expect(signUpPayload).toMatchObject({
      email: "ada@example.com",
      password: "pw-123456",
      options: { data: { consent_version: POLICY_VERSION } },
    });
    expect(signUpPayload.options.data.consent_accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mocks.track).toHaveBeenCalledWith("funnel_signup_completed", { locale: "en" }, { distinctId: "anon-test" });
  });

  it("points the confirmation email at /auth/confirm on the request origin", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });

    await POST(
      makeContext({ email: "ada@example.com", password: "pw-123456", consent: "on" }, "https://cv.example.com"),
    );

    const [signUpPayload] = mocks.signUp.mock.calls[0] as [SignUpPayload];
    expect(signUpPayload.options.emailRedirectTo).toBe("https://cv.example.com/auth/confirm");
  });

  it("does not emit when signUp returns an error", async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: new Error("already registered") });

    const response = await POST(makeContext({ email: "ada@example.com", password: "pw-123456", consent: "on" }));

    expect(response.headers.get("Location")).toContain("/auth/signup?error=");
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("rejects with consent_required and never calls signUp when consent is missing", async () => {
    const response = await POST(makeContext({ email: "ada@example.com", password: "pw-123456" }));

    expect(response.headers.get("Location")).toBe("/auth/signup?error=consent_required");
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
