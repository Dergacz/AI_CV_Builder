import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  createClient: vi.fn(),
  track: vi.fn(),
  readConsentCookie: vi.fn(),
  clearConsentCookie: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/observability", () => ({ track: mocks.track }));
vi.mock("@/lib/auth/consent-cookie", () => ({
  readConsentCookie: mocks.readConsentCookie,
  clearConsentCookie: mocks.clearConsentCookie,
}));

import { GET } from "@/pages/auth/callback";

function makeContext(query: string) {
  return {
    url: new URL(`http://localhost/auth/callback?${query}`),
    request: new Request(`http://localhost/auth/callback?${query}`),
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    redirect: (url: string, status = 302) => new Response(null, { status, headers: { Location: url } }),
    locals: { locale: "en", observability: { distinctId: "anon_x" } },
  };
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) {
    fn.mockReset();
  }
  mocks.createClient.mockReturnValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

describe("GET /auth/callback", () => {
  it("stamps consent and emits the google signup funnel event for a new account", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null });
    mocks.readConsentCookie.mockResolvedValue({ version: "2026-06-18", acceptedAt: "2026-06-19T00:00:00.000Z" });

    const response = await GET(makeContext("code=abc") as never);

    expect(mocks.updateUser).toHaveBeenCalledWith({
      data: { consent_version: "2026-06-18", consent_accepted_at: "2026-06-19T00:00:00.000Z" },
    });
    expect(mocks.track).toHaveBeenCalledWith(
      "funnel_signup_completed",
      { locale: "en", method: "google" },
      expect.anything(),
    );
    expect(mocks.clearConsentCookie).toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("signs out and bounces a new account that arrives without a consent cookie", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null });
    mocks.readConsentCookie.mockResolvedValue(null);

    const response = await GET(makeContext("code=abc") as never);

    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/auth/signup?error=consent_required");
  });

  it("links a returning account without re-stamping consent or re-emitting the funnel", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { user: { user_metadata: { consent_version: "2026-06-18" } } },
      error: null,
    });

    const response = await GET(makeContext("code=abc") as never);

    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("redirects to signin with oauth_failed when the code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { message: "bad code" } });

    const response = await GET(makeContext("code=abc") as never);

    expect(response.headers.get("Location")).toBe("/auth/signin?error=oauth_failed");
  });
});
