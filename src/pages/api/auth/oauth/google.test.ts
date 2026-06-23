import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInWithOAuth: vi.fn(), createClient: vi.fn() }));
const mockEnv = vi.hoisted(() => ({ salt: "test-salt" }));

vi.mock("@/lib/supabase", () => ({ createClient: mocks.createClient }));
vi.mock("astro:env/server", () => ({
  get OBSERVABILITY_ID_SALT() {
    return mockEnv.salt;
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
});
