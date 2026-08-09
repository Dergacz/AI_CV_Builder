import { beforeEach, describe, expect, it, vi } from "vitest";

// The module re-exports from `@/lib/supabase-admin`, which reads `astro:env/server` at import time.
vi.mock("astro:env/server", () => ({ SUPABASE_URL: "http://localhost", SUPABASE_SECRET_KEY: "secret" }));

import { deleteAccount, type DeleteAccountDeps } from "@/lib/services/account-deletion";

/**
 * S-08 deletion sequence — the ordering guarantee is what these tests exist for.
 *
 * `deleteUser` is the commit point. Before it, any failure must abort with nothing deleted; after
 * it, nothing may turn a completed erasure into a user-facing failure.
 */

const ACCOUNT_EMAIL = "ada@example.com";

function makeDeps(overrides: Partial<DeleteAccountDeps> = {}): DeleteAccountDeps {
  return {
    userId: "user-123",
    accountEmail: ACCOUNT_EMAIL,
    confirmation: ACCOUNT_EMAIL,
    isConfigured: vi.fn(() => true),
    deleteUser: vi.fn(() => Promise.resolve({ ok: true as const })),
    teardown: vi.fn(() => Promise.resolve()),
    reportFailure: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deleteAccount", () => {
  it("deletes the session user and tears down client state", async () => {
    const deps = makeDeps();

    const result = await deleteAccount(deps);

    expect(result).toEqual({ ok: true });
    expect(deps.deleteUser).toHaveBeenCalledExactlyOnceWith("user-123");
    expect(deps.teardown).toHaveBeenCalledTimes(1);
    expect(deps.reportFailure).not.toHaveBeenCalled();
  });

  it("refuses a mismatched confirmation WITHOUT deleting", async () => {
    const deps = makeDeps({ confirmation: "eve@example.com" });

    const result = await deleteAccount(deps);

    expect(result).toEqual({ ok: false, reason: "mismatch" });
    expect(deps.deleteUser).not.toHaveBeenCalled();
    expect(deps.teardown).not.toHaveBeenCalled();
  });

  it("accepts case and whitespace variants of the account email", async () => {
    const deps = makeDeps({ confirmation: "  Ada@Example.COM  " });

    await expect(deleteAccount(deps)).resolves.toEqual({ ok: true });
    expect(deps.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("refuses when the privileged path is unconfigured, WITHOUT deleting", async () => {
    const deps = makeDeps({ isConfigured: vi.fn(() => false) });

    const result = await deleteAccount(deps);

    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });

  it("checks configuration BEFORE the confirmation, so a misconfiguration is not masked", async () => {
    // Both would fail. The user must be told "unavailable", not "wrong email" — otherwise a broken
    // deployment reads to the user as their own typo, and they retype forever.
    const deps = makeDeps({ isConfigured: vi.fn(() => false), confirmation: "eve@example.com" });

    await expect(deleteAccount(deps)).resolves.toEqual({ ok: false, reason: "not_configured" });
  });

  it("reports and surfaces a failed deletion, and does not tear down the session", async () => {
    const error = new Error("admin api down");
    const deps = makeDeps({ deleteUser: vi.fn(() => Promise.resolve({ ok: false as const, error })) });

    const result = await deleteAccount(deps);

    expect(result).toEqual({ ok: false, reason: "delete_failed" });
    expect(deps.reportFailure).toHaveBeenCalledExactlyOnceWith(error, "delete");
    // Nothing was deleted, so the user keeps their working session.
    expect(deps.teardown).not.toHaveBeenCalled();
  });

  it("still succeeds when teardown throws — the account is already gone", async () => {
    const error = new Error("signOut failed");
    const deps = makeDeps({ teardown: vi.fn(() => Promise.reject(error)) });

    const result = await deleteAccount(deps);

    // The commit point passed. Reporting an error to the user here would state the opposite of
    // what happened; the stale cookies are inert and middleware purges them on the next request.
    expect(result).toEqual({ ok: true });
    expect(deps.reportFailure).toHaveBeenCalledExactlyOnceWith(error, "teardown");
  });

  it("fails closed when the session carries no email", async () => {
    const deps = makeDeps({ accountEmail: null, confirmation: "" });

    await expect(deleteAccount(deps)).resolves.toEqual({ ok: false, reason: "mismatch" });
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
});
