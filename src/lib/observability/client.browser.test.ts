import { beforeEach, describe, expect, it, vi } from "vitest";

const { captureMock, initMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  initMock: vi.fn(),
}));

vi.mock("astro:env/client", () => ({
  PUBLIC_POSTHOG_HOST: "",
  PUBLIC_POSTHOG_KEY: "",
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: captureMock,
    init: initMock,
  },
}));

type EventListener = (event: unknown) => void;

interface ListenerTarget {
  addEventListener(type: string, listener: EventListener): void;
}

async function loadClient() {
  return import("./client.browser");
}

describe("client observability", () => {
  beforeEach(() => {
    vi.resetModules();
    captureMock.mockReset();
    initMock.mockReset();
  });

  it("does not initialize PostHog when the public key is absent", async () => {
    const { initClientObservability } = await loadClient();

    expect(initClientObservability({ key: "", installErrorHandlers: false })).toBe(false);
    expect(initMock).not.toHaveBeenCalled();
  });

  it("initializes PostHog in cookieless manual-capture mode", async () => {
    const { initClientObservability } = await loadClient();

    expect(
      initClientObservability({
        host: "https://eu.i.posthog.com",
        installErrorHandlers: false,
        key: "phc_public",
      }),
    ).toBe(true);

    expect(initMock).toHaveBeenCalledWith(
      "phc_public",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        persistence: "memory",
      }),
    );
  });

  it("captures only scrubbed client properties after initialization", async () => {
    const { initClientObservability, trackClient } = await loadClient();
    initClientObservability({ key: "phc_public", installErrorHandlers: false });

    trackClient("observability_smoke", {
      answers: "raw answer text",
      error_location: "browser",
      surface: "client",
    });

    expect(captureMock).toHaveBeenCalledWith("observability_smoke", {
      $process_person_profile: false,
      error_location: "browser",
      surface: "client",
    });
    expect(JSON.stringify(captureMock.mock.calls)).not.toContain("raw answer text");
  });

  it("reports browser errors without message or stack content", async () => {
    const { initClientObservability, reportErrorClient } = await loadClient();
    initClientObservability({ key: "phc_public", installErrorHandlers: false });

    reportErrorClient(new TypeError("secret answer leaked"), { error_location: "browser" });

    expect(captureMock).toHaveBeenCalledWith("observability_error", {
      $process_person_profile: false,
      error_location: "browser",
      error_type: "TypeError",
    });
    expect(JSON.stringify(captureMock.mock.calls)).not.toContain("secret answer leaked");
    expect(JSON.stringify(captureMock.mock.calls)).not.toContain("stack");
  });

  it("attaches browser error handlers once and forwards only type/location", async () => {
    const { initClientObservability, installBrowserErrorHandlers } = await loadClient();
    const listeners: Record<string, EventListener> = {};
    const addEventListenerMock = vi.fn((type: string, listener: EventListener) => {
      listeners[type] = listener;
    });
    const target: ListenerTarget = { addEventListener: addEventListenerMock };

    initClientObservability({ key: "phc_public", installErrorHandlers: false });
    installBrowserErrorHandlers(target);
    installBrowserErrorHandlers(target);
    listeners.error({ error: new RangeError("secret"), filename: "/app.js", lineno: 12 });

    expect(addEventListenerMock).toHaveBeenCalledTimes(2);
    expect(captureMock).toHaveBeenCalledWith("observability_error", {
      $process_person_profile: false,
      error_location: "/app.js:12",
      error_type: "RangeError",
    });
    expect(JSON.stringify(captureMock.mock.calls)).not.toContain("secret");
  });
});
