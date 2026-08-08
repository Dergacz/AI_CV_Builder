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

  it("bootstraps the SDK with the server-provided distinct id", async () => {
    const { initClientObservability } = await loadClient();

    initClientObservability({ distinctId: "server-id", installErrorHandlers: false, key: "phc_public" });

    expect(initMock).toHaveBeenCalledWith(
      "phc_public",
      expect.objectContaining({
        bootstrap: { distinctID: "server-id" },
        persistence: "memory",
      }),
    );
  });

  it("omits bootstrap when no distinct id is provided", async () => {
    const { initClientObservability } = await loadClient();

    initClientObservability({ installErrorHandlers: false, key: "phc_public" });

    const config = initMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(config).not.toHaveProperty("bootstrap");
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

    reportErrorClient(new TypeError("secret answer leaked"), { error_location: "client:unhandledrejection" });

    expect(captureMock).toHaveBeenCalledWith("observability_error", {
      $process_person_profile: false,
      error_location: "client:unhandledrejection",
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

/**
 * S-07 dedupe. The unbounded emission risk is client-side — a render loop or a retry storm can
 * fire without limit, unlike server emits which are bounded by request rate.
 */
describe("client error dedupe", () => {
  beforeEach(() => {
    // `loadClient` re-imports the module, so the dedupe map starts empty per test.
    vi.resetModules();
    captureMock.mockReset();
    initMock.mockReset();
  });

  it("suppresses a repeat of the same error type and location inside the window", async () => {
    const { initClientObservability, reportErrorClient } = await loadClient();
    initClientObservability({ key: "phc_public", installErrorHandlers: false });

    reportErrorClient(new TypeError("boom"), { error_location: "hooks/useCvExport:render" });
    reportErrorClient(new TypeError("boom again"), { error_location: "hooks/useCvExport:render" });
    reportErrorClient(new TypeError("and again"), { error_location: "hooks/useCvExport:render" });

    expect(captureMock).toHaveBeenCalledOnce();
  });

  it("does not suppress a different error type or a different location", async () => {
    const { initClientObservability, reportErrorClient } = await loadClient();
    initClientObservability({ key: "phc_public", installErrorHandlers: false });

    reportErrorClient(new TypeError("boom"), { error_location: "hooks/useCvExport:render" });
    // Same location, different type.
    reportErrorClient(new RangeError("boom"), { error_location: "hooks/useCvExport:render" });
    // Same type, different location.
    reportErrorClient(new TypeError("boom"), { error_location: "hooks/useCvSave:transport" });

    expect(captureMock).toHaveBeenCalledTimes(3);
  });

  it("re-emits after the window is cleared", async () => {
    const { initClientObservability, reportErrorClient, resetClientErrorDedupe } = await loadClient();
    initClientObservability({ key: "phc_public", installErrorHandlers: false });

    reportErrorClient(new TypeError("boom"), { error_location: "hooks/useCvExport:render" });
    resetClientErrorDedupe();
    reportErrorClient(new TypeError("boom"), { error_location: "hooks/useCvExport:render" });

    expect(captureMock).toHaveBeenCalledTimes(2);
  });

  it("does not consume the dedupe slot for errors raised before initialization", async () => {
    const { initClientObservability, reportErrorClient } = await loadClient();

    // Uninitialized: captures nothing, and must not record the key — otherwise the first *real*
    // capture of the same failure would be silently swallowed.
    reportErrorClient(new TypeError("boom"), { error_location: "hooks/useCvExport:render" });
    expect(captureMock).not.toHaveBeenCalled();

    initClientObservability({ key: "phc_public", installErrorHandlers: false });
    reportErrorClient(new TypeError("boom"), { error_location: "hooks/useCvExport:render" });

    expect(captureMock).toHaveBeenCalledOnce();
  });
});
