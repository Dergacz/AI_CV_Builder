import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * S-08: the configuration predicate that decides whether the deletion surface is usable at all.
 *
 * `astro:env/server` bindings are resolved at import time, so each case re-imports the module
 * under a different mock rather than mutating a shared one.
 */

async function importWithEnv(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.doMock("astro:env/server", () => env);
  return import("@/lib/supabase-admin");
}

afterEach(() => {
  vi.doUnmock("astro:env/server");
  vi.resetModules();
});

describe("isAdminConfigured", () => {
  it("is true when both the URL and the secret key are present", async () => {
    const { isAdminConfigured } = await importWithEnv({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SECRET_KEY: "sb_secret_xxx",
    });

    expect(isAdminConfigured()).toBe(true);
  });

  it("is false when the secret key is absent — the local-dev and unconfigured-prod state", async () => {
    const { isAdminConfigured } = await importWithEnv({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SECRET_KEY: undefined,
    });

    expect(isAdminConfigured()).toBe(false);
  });

  it("is false when the URL is absent", async () => {
    const { isAdminConfigured } = await importWithEnv({
      SUPABASE_URL: undefined,
      SUPABASE_SECRET_KEY: "sb_secret_xxx",
    });

    expect(isAdminConfigured()).toBe(false);
  });

  it("treats a blank secret as absent, so a stray empty env var cannot look configured", async () => {
    const { isAdminConfigured } = await importWithEnv({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SECRET_KEY: "   ",
    });

    expect(isAdminConfigured()).toBe(false);
  });
});

describe("deleteUserAccount", () => {
  it("refuses without attempting anything when unconfigured", async () => {
    const { deleteUserAccount } = await importWithEnv({
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SECRET_KEY: undefined,
    });

    const result = await deleteUserAccount("user-123");

    expect(result.ok).toBe(false);
  });
});
