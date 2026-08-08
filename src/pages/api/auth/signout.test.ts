import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  reportError: vi.fn(),
}));

// Mutable signOut stub so each test can choose success vs. failure.
let signOutResult: { error: { message: string } | null } = { error: null };

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      signOut: () => Promise.resolve(signOutResult),
    },
  }),
}));

vi.mock("@/lib/observability", () => ({ track: mocks.track, reportError: mocks.reportError }));

import { POST } from "@/pages/api/auth/signout";

function makeContext() {
  return {
    request: new Request("http://localhost/api/auth/signout", { method: "POST" }),
    cookies: {},
    locals: { observability: { distinctId: "anon-test" } },
    // Mirror Astro's context.redirect: a 302 with a Location header.
    redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  } as never;
}

describe("POST /api/auth/signout", () => {
  it("surfaces a failed sign-out instead of redirecting to '/' as success", async () => {
    signOutResult = { error: { message: "boom" } };

    const response = await POST(makeContext());

    // A swallowed error would still land on "/"; the fix must surface it.
    expect(response.headers.get("Location")).toBe("/dashboard?signout_error=1");
    // S-07: the breadcrumb is now a real report, not a console.warn.
    expect(mocks.reportError).toHaveBeenCalledOnce();
    const [, context] = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toBe("api/auth/signout:signout");
    // The provider message the old console.warn interpolated must not travel.
    expect(JSON.stringify(context)).not.toContain("boom");
  });

  it("reports nothing on a successful sign-out", async () => {
    mocks.reportError.mockClear();
    signOutResult = { error: null };

    await POST(makeContext());

    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("redirects home on a successful sign-out", async () => {
    signOutResult = { error: null };

    const response = await POST(makeContext());

    expect(response.headers.get("Location")).toBe("/");
  });
});
