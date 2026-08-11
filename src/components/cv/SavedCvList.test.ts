import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S-07 p4: client transport reporting for the saved-CV delete seam.
 *
 * Transport failures only. A non-ok envelope was already reported server-side with a precise
 * location (`api/cv/[id]:delete`, p2), and a 404 for a CV that is missing or not owned is not a
 * defect at all — reporting either here would bury the real failures.
 */

const mocks = vi.hoisted(() => ({
  reportErrorClient: vi.fn(),
}));

vi.mock("@/lib/observability/client.browser", () => ({
  reportErrorClient: mocks.reportErrorClient,
  trackClient: vi.fn(),
}));

import { deleteCvRequest } from "@/components/cv/SavedCvList";

type FetchSignature = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function stubJson(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<FetchSignature>(() => Promise.resolve({ json: () => Promise.resolve(payload) } as unknown as Response)),
  );
}

function stubTransportFailure(error: Error = new TypeError("Failed to fetch")): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<FetchSignature>(() => Promise.reject(error)),
  );
}

beforeEach(() => {
  mocks.reportErrorClient.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deleteCvRequest", () => {
  it("reports once when the request never completes", async () => {
    stubTransportFailure();

    expect(await deleteCvRequest("cv-1")).toBeNull();
    expect(mocks.reportErrorClient).toHaveBeenCalledOnce();
    const [, context] = mocks.reportErrorClient.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toBe("components/SavedCvList:delete");
  });

  it("reports nothing for a not-found or server-failure envelope", async () => {
    stubJson({ ok: false, error: "not_found", message: "gone" });
    await deleteCvRequest("cv-1");

    stubJson({ ok: false, error: "delete_failed", message: "boom" });
    await deleteCvRequest("cv-1");

    expect(mocks.reportErrorClient).not.toHaveBeenCalled();
  });

  it("reports nothing on a successful delete", async () => {
    stubJson({ ok: true });

    expect(await deleteCvRequest("cv-1")).toEqual({ ok: true });
    expect(mocks.reportErrorClient).not.toHaveBeenCalled();
  });
});
