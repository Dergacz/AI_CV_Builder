import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S-07 scheduler contract. Two rules that are easy to regress:
 *   1. On Workers the emit is handed to `cfContext.waitUntil`, so a fire-and-forget report is not
 *      cancelled the moment the response is returned.
 *   2. The scheduler NEVER throws and never produces an unhandled rejection — observability must
 *      not be able to break the path it observes, including when its emit is stubbed out.
 */

const mocks = vi.hoisted(() => ({
  reportError: vi.fn(),
}));

vi.mock("./index", () => ({ reportError: mocks.reportError }));

import { scheduleEmit, scheduleErrorReport } from "./schedule";

beforeEach(() => {
  mocks.reportError.mockReset();
  mocks.reportError.mockResolvedValue(undefined);
});

describe("scheduleEmit", () => {
  it("hands the emit to cfContext.waitUntil when the Worker runtime provides it", () => {
    const waitUntil = vi.fn();

    scheduleEmit(Promise.resolve("emitted"), { cfContext: { waitUntil } });

    expect(waitUntil).toHaveBeenCalledOnce();
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("runs detached without throwing when there is no Worker runtime (dev/node)", () => {
    expect(() => {
      scheduleEmit(Promise.resolve("emitted"));
    }).not.toThrow();
    expect(() => {
      scheduleEmit(Promise.resolve("emitted"), {});
    }).not.toThrow();
    expect(() => {
      scheduleEmit(Promise.resolve("emitted"), { cfContext: {} });
    }).not.toThrow();
  });

  it("swallows a rejected emit so it never surfaces as an unhandled rejection", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    scheduleEmit(Promise.reject(new Error("posthog unreachable")));
    // Let the microtask queue drain past the rejection before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("degrades to a no-op when the emit is stubbed out rather than a promise", () => {
    // Every route test mocks `@/lib/observability`, so `reportError` returns undefined there.
    expect(() => {
      scheduleEmit(undefined as unknown as Promise<unknown>);
    }).not.toThrow();
  });
});

describe("scheduleErrorReport", () => {
  it("reports with the request's resolved identity, without awaiting", () => {
    const waitUntil = vi.fn();

    scheduleErrorReport(
      new Error("boom"),
      { error_location: "api/cv/generate:recordGeneration" },
      { cfContext: { waitUntil }, observability: { distinctId: "pseudo-id" } },
    );

    expect(mocks.reportError).toHaveBeenCalledOnce();
    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      { error_location: "api/cv/generate:recordGeneration" },
      { distinctId: "pseudo-id" },
    );
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it("still reports when no identity is resolvable (emit itself no-ops)", () => {
    scheduleErrorReport(new Error("boom"), { error_location: "middleware:unhandled" });

    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      { error_location: "middleware:unhandled" },
      undefined,
    );
  });
});
