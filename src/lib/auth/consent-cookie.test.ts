import { beforeEach, describe, expect, it, vi } from "vitest";
import { POLICY_VERSION } from "@/lib/legal/policy";

const mockEnv = vi.hoisted(() => ({ salt: "test-salt" }));

vi.mock("astro:env/server", () => ({
  get OBSERVABILITY_ID_SALT() {
    return mockEnv.salt;
  },
}));

const COOKIE_NAME = "oauth_consent";

function makeJar() {
  const store = new Map<string, string>();
  return {
    store,
    get: (name: string) => {
      const value = store.get(name);
      return value === undefined ? undefined : { value };
    },
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      store.delete(name);
    }),
  };
}

beforeEach(() => {
  mockEnv.salt = "test-salt";
});

describe("consent cookie", () => {
  it("round-trips the consent payload through a signed cookie", async () => {
    const { setConsentCookie, readConsentCookie } = await import("./consent-cookie");
    const jar = makeJar();

    await setConsentCookie(jar);
    const payload = await readConsentCookie(jar);

    expect(payload?.version).toBe(POLICY_VERSION);
    expect(payload?.acceptedAt).toEqual(expect.any(String));
  });

  it("rejects a tampered cookie as null", async () => {
    const { setConsentCookie, readConsentCookie } = await import("./consent-cookie");
    const jar = makeJar();

    await setConsentCookie(jar);
    const parts = (jar.store.get(COOKIE_NAME) ?? "").split("|");
    parts[0] = "9999-99-99";
    jar.store.set(COOKIE_NAME, parts.join("|"));

    expect(await readConsentCookie(jar)).toBeNull();
  });

  it("returns null and writes nothing when the signing secret is absent (fail closed)", async () => {
    mockEnv.salt = "";
    const { setConsentCookie, readConsentCookie } = await import("./consent-cookie");
    const jar = makeJar();

    await setConsentCookie(jar);

    expect(jar.set).not.toHaveBeenCalled();
    expect(await readConsentCookie(jar)).toBeNull();
  });
});
