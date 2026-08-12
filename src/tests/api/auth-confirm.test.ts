import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Confirmation-link landing route (S-10, R-16).
 *
 * The branch that matters most is the failed exchange: GoTrue verifies the address before it
 * redirects here, so a browser that cannot complete the PKCE exchange (signed up on a laptop, opened
 * the mail on a phone — the code verifier cookie lives on the laptop) belongs on the sign-in page
 * with a *success* notice. Routing that case to an error would tell the user the opposite of what
 * happened, so the test asserts the absence of `error=` as well as the presence of the notice.
 */

const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), createClient: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ createClient: mocks.createClient }));

import { GET } from "@/pages/auth/confirm";

function makeContext(query: string) {
  const url = new URL(`https://cv.example.com/auth/confirm${query ? `?${query}` : ""}`);
  return {
    url,
    request: new Request(url),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    redirect: (location: string, status = 302) => new Response(null, { status, headers: { Location: location } }),
    locals: { locale: "en", observability: { distinctId: "anon_x" } },
  } as never;
}

beforeEach(() => {
  mocks.exchangeCodeForSession.mockReset();
  mocks.createClient.mockReset();
  mocks.createClient.mockReturnValue({ auth: { exchangeCodeForSession: mocks.exchangeCodeForSession } });
});

describe("GET /auth/confirm", () => {
  it("signs the user in and lands them on the dashboard when the exchange succeeds", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });

    const response = await GET(makeContext("code=abc"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("reports the email as confirmed when the exchange fails on another device", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: "no verifier" } });

    const response = await GET(makeContext("code=abc"));

    const location = response.headers.get("Location");
    expect(location).toBe("/auth/signin?notice=email_confirmed");
    expect(location).not.toContain("error=");
  });

  it("sends an expired or reused link back with the resend-prompting message", async () => {
    const expired = await GET(makeContext("error=access_denied&error_code=otp_expired"));
    const codeless = await GET(makeContext(""));

    expect(expired.headers.get("Location")).toBe("/auth/signin?error=email_not_confirmed");
    expect(codeless.headers.get("Location")).toBe("/auth/signin?error=email_not_confirmed");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("reports auth as unavailable when Supabase is not configured", async () => {
    mocks.createClient.mockReturnValue(null);

    const response = await GET(makeContext("code=abc"));

    expect(response.headers.get("Location")).toBe("/auth/signin?error=auth_unavailable");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
