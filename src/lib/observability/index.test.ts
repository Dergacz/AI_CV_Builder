import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  key: "",
  host: "https://eu.i.posthog.com",
}));

vi.mock("astro:env/server", () => ({
  get POSTHOG_API_KEY() {
    return mockEnv.key;
  },
  get POSTHOG_HOST() {
    return mockEnv.host;
  },
}));

describe("server observability", () => {
  beforeEach(() => {
    mockEnv.key = "";
    mockEnv.host = "https://eu.i.posthog.com";
    vi.unstubAllGlobals();
  });

  it("does not call fetch when PostHog is unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { track } = await import("./index");

    await track("observability_smoke", { surface: "server" }, { distinctId: "anon-session" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emits scrubbed events to the EU capture endpoint", async () => {
    mockEnv.key = "phc_test";
    let capturedBody = "";
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        capturedBody = init.body;
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { track } = await import("./index");

    await track(
      "observability_smoke",
      { surface: "server", route: "/api/test", answers: "raw answer" },
      { distinctId: "anon-session" },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://eu.i.posthog.com/i/v0/e/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(capturedBody) as Record<string, unknown>;
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "observability_smoke",
      distinct_id: "anon-session",
      properties: { surface: "server", route: "/api/test", $process_person_profile: false },
    });
    expect(JSON.stringify(body)).not.toContain("raw answer");
  });

  it("swallows PostHog fetch failures", async () => {
    mockEnv.key = "phc_test";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const { track } = await import("./index");

    await expect(track("observability_smoke", { surface: "server" }, { distinctId: "anon-session" })).resolves.toBe(
      undefined,
    );
  });

  it("reports errors without message or stack content", async () => {
    mockEnv.key = "phc_test";
    let capturedBody = "";
    const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        capturedBody = init.body;
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { reportError } = await import("./index");

    await reportError(new TypeError("secret answer leaked"), { error_location: "generate" }, { distinctId: "anon" });

    const body = JSON.parse(capturedBody) as Record<string, unknown>;
    expect(body).toMatchObject({
      event: "observability_error",
      properties: { error_type: "TypeError", error_location: "generate", $process_person_profile: false },
    });
    expect(JSON.stringify(body)).not.toContain("secret answer leaked");
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
