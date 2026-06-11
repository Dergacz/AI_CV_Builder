import { describe, expect, it, vi } from "vitest";

import { safeGetUser } from "@/lib/supabase";

// The real module reads SUPABASE_URL/KEY from astro:env/server at import time.
vi.mock("astro:env/server", () => ({ SUPABASE_URL: "http://localhost", SUPABASE_KEY: "anon" }));

interface AuthStub {
  getUser: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}

function stubClient(auth: Partial<AuthStub>) {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  return {
    client: { auth: { signOut, ...auth } } as never,
    signOut,
  };
}

describe("safeGetUser", () => {
  it("returns the user on a successful getUser()", async () => {
    const user = { id: "user-123" };
    const { client } = stubClient({ getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) });

    await expect(safeGetUser(client)).resolves.toBe(user);
  });

  it("returns null and clears the session on an invalid refresh token error", async () => {
    const error = { name: "AuthApiError", code: "refresh_token_not_found", status: 400 };
    const { client, signOut } = stubClient({
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error }),
    });

    await expect(safeGetUser(client)).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("returns null when getUser() throws", async () => {
    const { client, signOut } = stubClient({
      getUser: vi.fn().mockRejectedValue(new Error("Invalid Refresh Token")),
    });

    await expect(safeGetUser(client)).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledOnce();
  });
});
