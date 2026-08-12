import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInWithOAuth: vi.fn(), createClient: vi.fn() }));
const mockEnv = vi.hoisted(() => ({ salt: "test-salt", googleClientId: "test-google-client-id" }));

vi.mock("@/lib/supabase", () => ({ createClient: mocks.createClient }));
vi.mock("astro:env/server", () => ({
  get OBSERVABILITY_ID_SALT() {
    return mockEnv.salt;
  },
  // Getter rather than a fixed value: the route's availability gate reads this per call, so a test
  // can blank it mid-suite to exercise the unconfigured branch.
  get SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID() {
    return mockEnv.googleClientId;
  },
}));

import { POST } from "@/pages/api/auth/oauth/google";

const GOOGLE_URL = "https://accounts.google.com/o/oauth2/auth?client_id=x";

function makeContext(form: Record<string, string>) {
  const store = new Map<string, string>();
  const cookies = {
    get: (name: string) => {
      const value = store.get(name);
      return value === undefined ? undefined : { value };
    },
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
    delete: vi.fn(),
  };
  const context = {
    request: new Request("http://localhost/api/auth/oauth/google", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    }),
    cookies,
    url: new URL("http://localhost/api/auth/oauth/google"),
    redirect: (url: string, status = 302) => new Response(null, { status, headers: { Location: url } }),
  };
  return { context, cookies };
}

beforeEach(() => {
  mockEnv.salt = "test-salt";
  mockEnv.googleClientId = "test-google-client-id";
  mocks.signInWithOAuth.mockReset();
  mocks.createClient.mockReturnValue({ auth: { signInWithOAuth: mocks.signInWithOAuth } });
  mocks.signInWithOAuth.mockResolvedValue({ data: { url: GOOGLE_URL }, error: null });
});

describe("POST /api/auth/oauth/google", () => {
  it("rejects a signup-intent start without consent and never calls Supabase", async () => {
    const { context, cookies } = makeContext({ intent: "signup" });

    const response = await POST(context as never);

    expect(response.headers.get("Location")).toBe("/auth/signup?error=consent_required");
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(cookies.set).not.toHaveBeenCalledWith("oauth_consent", expect.anything(), expect.anything());
  });

  it("sets the consent cookie and redirects to the provider URL on a consented signup", async () => {
    const { context, cookies } = makeContext({ intent: "signup", consent: "on" });

    const response = await POST(context as never);

    expect(cookies.set).toHaveBeenCalledWith("oauth_consent", expect.any(String), expect.anything());
    expect(response.headers.get("Location")).toBe(GOOGLE_URL);
  });

  it("starts the signin-intent flow without setting a consent cookie", async () => {
    const { context, cookies } = makeContext({ intent: "signin" });

    const response = await POST(context as never);

    expect(cookies.set).not.toHaveBeenCalledWith("oauth_consent", expect.anything(), expect.anything());
    expect(response.headers.get("Location")).toBe(GOOGLE_URL);
  });

  /**
   * R-17. The route stays reachable by direct POST, stale HTML, or a cached page no matter what the
   * auth pages rendered, so hiding the button does not close the dead end on its own. Without this
   * gate `signInWithOAuth` still succeeds — it only builds a URL — and the browser leaves for
   * Supabase's "Unsupported provider" page, past anything we could report or localize.
   */
  describe("when the Google provider is not configured", () => {
    beforeEach(() => {
      mockEnv.googleClientId = "";
    });

    it("refuses a signin-intent start and never calls Supabase", async () => {
      const { context } = makeContext({ intent: "signin" });

      const response = await POST(context as never);

      expect(response.headers.get("Location")).toBe("/auth/signin?error=google_unavailable");
      expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    });

    it("refuses a consented signup WITHOUT leaving a consent cookie behind", async () => {
      const { context, cookies } = makeContext({ intent: "signup", consent: "on" });

      const response = await POST(context as never);

      expect(response.headers.get("Location")).toBe("/auth/signin?error=google_unavailable");
      // The ordering guarantee: the gate runs before setConsentCookie, so a refused signup does not
      // strand a signed cookie in the browser with no OAuth round-trip left to consume or clear it.
      expect(cookies.set).not.toHaveBeenCalledWith("oauth_consent", expect.anything(), expect.anything());
      expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    });

    it("still reports the missing consent first — it is the more specific complaint", async () => {
      const { context, cookies } = makeContext({ intent: "signup" });

      const response = await POST(context as never);

      expect(response.headers.get("Location")).toBe("/auth/signup?error=consent_required");
      expect(cookies.set).not.toHaveBeenCalledWith("oauth_consent", expect.anything(), expect.anything());
    });

    it.each(["   ", "\t"])("treats a whitespace-only client id as unconfigured (%j)", async (value) => {
      mockEnv.googleClientId = value;
      const { context } = makeContext({ intent: "signin" });

      const response = await POST(context as never);

      expect(response.headers.get("Location")).toBe("/auth/signin?error=google_unavailable");
    });
  });
});
