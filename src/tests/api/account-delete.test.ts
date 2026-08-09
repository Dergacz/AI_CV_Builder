import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/account/delete — contract tests (S-08 / FR-011).
 *
 * Locks the five status codes, the ordering guarantee around the commit point, the client-state
 * teardown, and the invariant that matters most on an irreversible endpoint: the identity being
 * deleted comes from the verified session and can never be supplied by the caller.
 *
 * The admin module is mocked at its boundary (`@/lib/supabase-admin`) so the real service and the
 * real route logic run — only the privileged call itself is faked.
 */

const mocks = vi.hoisted(() => ({
  deleteUserAccount: vi.fn(),
  isAdminConfigured: vi.fn(),
  reportError: vi.fn(),
  track: vi.fn(),
  safeGetUser: vi.fn(),
  createClient: vi.fn(),
  signOut: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  deleteUserAccount: mocks.deleteUserAccount,
  isAdminConfigured: mocks.isAdminConfigured,
}));
vi.mock("@/lib/observability", () => ({ track: mocks.track, reportError: mocks.reportError }));
vi.mock("@/lib/supabase", () => ({
  createClient: mocks.createClient,
  safeGetUser: mocks.safeGetUser,
}));

import { POST } from "@/pages/api/account/delete";

const ACCOUNT_EMAIL = "ada@example.com";
const USER = { id: "user-123", email: ACCOUNT_EMAIL };

function makeContext(opts: { user?: { id: string } | null; body?: unknown; rawBody?: string }) {
  return {
    locals: {
      user: opts.user === undefined ? USER : opts.user,
      observability: { distinctId: "pseudo-test" },
      locale: "en" as const,
    },
    request: new Request("http://localhost/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: opts.rawBody ?? JSON.stringify(opts.body ?? { confirmation: ACCOUNT_EMAIL }),
    }),
    cookies: { delete: mocks.cookieDelete },
  } as never;
}

async function readBody(res: Response) {
  return (await res.json()) as { ok: boolean; error?: string; redirectTo?: string; message?: string };
}

beforeEach(() => {
  mocks.isAdminConfigured.mockReturnValue(true);
  mocks.deleteUserAccount.mockResolvedValue({ ok: true });
  mocks.createClient.mockReturnValue({ auth: { signOut: mocks.signOut } });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.safeGetUser.mockResolvedValue(USER);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/account/delete", () => {
  it("deletes the account and returns the post-deletion redirect", async () => {
    const res = await POST(makeContext({}));

    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("/?deleted=1");
    expect(mocks.deleteUserAccount).toHaveBeenCalledExactlyOnceWith("user-123");
  });

  it("tears down the session and the identity cookies on success", async () => {
    await POST(makeContext({}));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    // The two cookies that tie this browser to the deleted identity.
    expect(mocks.cookieDelete).toHaveBeenCalledWith("obs_session", { path: "/" });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("obs_confirmed", { path: "/" });
    // `ui_locale` is a device preference, not personal data — clearing it would flip the UI to
    // English exactly when the user reads the confirmation.
    expect(mocks.cookieDelete).not.toHaveBeenCalledWith("ui_locale", expect.anything());
    expect(mocks.cookieDelete).toHaveBeenCalledTimes(2);
  });

  it("returns 401 when there is no session, without deleting", async () => {
    const res = await POST(makeContext({ user: null }));

    expect(res.status).toBe(401);
    expect((await readBody(res)).error).toBe("session_expired");
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("returns 401 when the session fails re-verification, without deleting", async () => {
    mocks.safeGetUser.mockResolvedValue(null);

    const res = await POST(makeContext({}));

    expect(res.status).toBe(401);
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("returns 400 for a mismatched confirmation, without deleting", async () => {
    const res = await POST(makeContext({ body: { confirmation: "eve@example.com" } }));

    expect(res.status).toBe(400);
    expect((await readBody(res)).error).toBe("confirmation_mismatch");
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("accepts case and whitespace variants of the account email", async () => {
    const res = await POST(makeContext({ body: { confirmation: "  Ada@Example.COM  " } }));

    expect(res.status).toBe(200);
    expect(mocks.deleteUserAccount).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for a malformed body, without deleting", async () => {
    const res = await POST(makeContext({ rawBody: "not json" }));

    expect(res.status).toBe(400);
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("returns 400 when the confirmation field is missing, without deleting", async () => {
    const res = await POST(makeContext({ body: {} }));

    expect(res.status).toBe(400);
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("returns 503 when the admin key is absent, without deleting", async () => {
    mocks.isAdminConfigured.mockReturnValue(false);

    const res = await POST(makeContext({}));

    expect(res.status).toBe(503);
    expect((await readBody(res)).error).toBe("service_unavailable");
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase itself is unconfigured", async () => {
    mocks.createClient.mockReturnValue(null);

    const res = await POST(makeContext({}));

    expect(res.status).toBe(503);
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("returns 500 and reports when the deletion fails", async () => {
    mocks.deleteUserAccount.mockResolvedValue({ ok: false, error: new Error("boom") });

    const res = await POST(makeContext({}));

    expect(res.status).toBe(500);
    expect((await readBody(res)).error).toBe("delete_failed");
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ error_location: "api/account/delete:delete" }),
      expect.anything(),
    );
    // Nothing was deleted — the user keeps a working session.
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("still returns 200 when teardown throws, and reports it separately", async () => {
    mocks.signOut.mockRejectedValue(new Error("signOut failed"));

    const res = await POST(makeContext({}));

    // The account is gone; an error here would tell the user the opposite of the truth.
    expect(res.status).toBe(200);
    expect((await readBody(res)).ok).toBe(true);
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ error_location: "api/account/delete:teardown" }),
      expect.anything(),
    );
  });

  it("emits no success event — no new identified event at the moment of erasure", async () => {
    await POST(makeContext({}));

    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("deletes the SESSION user, never a caller-supplied id", async () => {
    // The invariant that separates a deletion endpoint from an account-deletion vulnerability.
    const res = await POST(
      makeContext({ body: { confirmation: ACCOUNT_EMAIL, userId: "victim-999", id: "victim-999" } }),
    );

    expect(res.status).toBe(200);
    expect(mocks.deleteUserAccount).toHaveBeenCalledExactlyOnceWith("user-123");
    expect(mocks.deleteUserAccount).not.toHaveBeenCalledWith("victim-999");
  });

  it("compares the confirmation against the SESSION email, not a caller-supplied one", async () => {
    const res = await POST(makeContext({ body: { confirmation: "eve@example.com", accountEmail: "eve@example.com" } }));

    expect(res.status).toBe(400);
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before parsing", async () => {
    const res = await POST(makeContext({ rawBody: JSON.stringify({ confirmation: "a".repeat(5_000) }) }));

    expect(res.status).toBe(400);
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });
});
