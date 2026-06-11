import { describe, expect, it, vi } from "vitest";

import { POST } from "@/pages/api/auth/signout";

// Mutable signOut stub so each test can choose success vs. failure.
let signOutResult: { error: { message: string } | null } = { error: null };

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      signOut: () => Promise.resolve(signOutResult),
    },
  }),
}));

function makeContext() {
  return {
    request: new Request("http://localhost/api/auth/signout", { method: "POST" }),
    cookies: {},
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
  });

  it("redirects home on a successful sign-out", async () => {
    signOutResult = { error: null };

    const response = await POST(makeContext());

    expect(response.headers.get("Location")).toBe("/");
  });
});
