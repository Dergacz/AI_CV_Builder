import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  salt: "test-salt",
}));

vi.mock("astro:env/server", () => ({
  get OBSERVABILITY_ID_SALT() {
    return mockEnv.salt;
  },
}));

describe("getPseudonymousUserId", () => {
  beforeEach(() => {
    mockEnv.salt = "test-salt";
  });

  it("derives a stable non-raw id for the same user and salt", async () => {
    const { getPseudonymousUserId } = await import("./identity");

    const first = await getPseudonymousUserId("user-123");
    const second = await getPseudonymousUserId("user-123");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe("user-123");
  });

  it("derives different ids for different users", async () => {
    const { getPseudonymousUserId } = await import("./identity");

    await expect(getPseudonymousUserId("user-123")).resolves.not.toBe(await getPseudonymousUserId("user-456"));
  });

  it("returns null when the salt is missing", async () => {
    mockEnv.salt = "";
    const { getPseudonymousUserId } = await import("./identity");

    await expect(getPseudonymousUserId("user-123")).resolves.toBeNull();
  });
});

describe("getAnonSessionId", () => {
  it("reuses an existing anonymous session id from cookies", async () => {
    const { getAnonSessionId } = await import("./identity");
    const cookies = {
      get: vi.fn().mockReturnValue({ value: "existing-session" }),
      set: vi.fn(),
    };

    expect(getAnonSessionId(cookies)).toBe("existing-session");
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it("mints a new anonymous session id when missing", async () => {
    const { getAnonSessionId } = await import("./identity");
    const cookies = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
    };

    const sessionId = getAnonSessionId(cookies);

    expect(sessionId).toMatch(/^anon_[a-f0-9-]{36}$/);
    expect(cookies.set).toHaveBeenCalledWith(
      "obs_session",
      sessionId,
      expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: true }),
    );
  });
});
