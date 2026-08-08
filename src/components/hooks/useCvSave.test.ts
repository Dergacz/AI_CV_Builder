import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S-07 p4: client transport reporting for the CV save/delete/generate seams.
 *
 * The rule these tests exist to lock: the client reports the TRANSPORT failure only. A non-ok
 * response means the server answered and already reported the failure itself with a precise
 * location (p2/p3) — reporting it again here would double-count every server-side failure and
 * make the rates unusable. Getting this wrong is silent: the monitor still "works", it just lies.
 */

const mocks = vi.hoisted(() => ({
  reportErrorClient: vi.fn(),
}));

vi.mock("@/lib/observability/client.browser", () => ({
  reportErrorClient: mocks.reportErrorClient,
  trackClient: vi.fn(),
}));

import { postCvSave } from "@/components/hooks/useCvSave";
import { deleteCvRequest } from "@/components/cv/SavedCvList";
import { postCvGenerate } from "@/components/cv/QuestionnaireFlow";
import { defaultCvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

type FetchSignature = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Stub fetch with a resolved JSON envelope. */
function stubJson(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<FetchSignature>(() => Promise.resolve({ json: () => Promise.resolve(payload) } as unknown as Response)),
  );
}

/** Stub fetch so the request never completes — the case nothing else in the system sees. */
function stubTransportFailure(error: Error = new TypeError("Failed to fetch")): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<FetchSignature>(() => Promise.reject(error)),
  );
}

/** Stub fetch with a 2xx whose body is not JSON — the answer arrived but is unusable. */
function stubUnparseableBody(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn<FetchSignature>(() =>
      Promise.resolve({ json: () => Promise.reject(new SyntaxError("Unexpected token <")) } as unknown as Response),
    ),
  );
}

beforeEach(() => {
  mocks.reportErrorClient.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postCvSave", () => {
  it("reports once when the request never completes", async () => {
    stubTransportFailure();

    const result = await postCvSave("/api/cv", "POST", { title: "My CV" });

    expect(result).toBeNull();
    expect(mocks.reportErrorClient).toHaveBeenCalledOnce();
    const [, context] = mocks.reportErrorClient.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toBe("hooks/useCvSave:transport");
  });

  it("reports when the response body is not usable JSON", async () => {
    stubUnparseableBody();

    expect(await postCvSave("/api/cv", "POST", {})).toBeNull();
    expect(mocks.reportErrorClient).toHaveBeenCalledOnce();
  });

  it("reports NOTHING for a server-side failure envelope — p2 already reported it", async () => {
    stubJson({ ok: false, error: "save_failed", message: "nope" });

    const result = await postCvSave("/api/cv", "POST", {});

    expect(result).toEqual({ ok: false, error: "save_failed", message: "nope" });
    expect(mocks.reportErrorClient).not.toHaveBeenCalled();
  });

  it("reports nothing on success", async () => {
    stubJson({ ok: true, cv: { id: "cv-1", title: "My CV" } });

    await postCvSave("/api/cv", "POST", {});

    expect(mocks.reportErrorClient).not.toHaveBeenCalled();
  });

  it("never puts draft or answer content into the report", async () => {
    const SECRET = "Confidential-Employer-Quux-Detail";
    stubTransportFailure(new TypeError(`Failed to fetch ${SECRET}`));

    await postCvSave("/api/cv", "POST", { draft: { summary: SECRET }, answers: { experience: SECRET } });

    const [, context] = mocks.reportErrorClient.mock.calls[0] as [unknown, Record<string, unknown>];
    // The payload we hand the reporter carries a location and nothing else; the error object's
    // message is dropped by `reportErrorClient` itself (see client.browser.test.ts).
    expect(JSON.stringify(context)).not.toContain(SECRET);
    expect(Object.keys(context)).toEqual(["error_location"]);
  });
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
});

describe("postCvGenerate", () => {
  it("reports once when the request never reaches the server", async () => {
    stubTransportFailure();

    expect(await postCvGenerate(defaultCvQuestionnaireAnswers)).toBeNull();
    expect(mocks.reportErrorClient).toHaveBeenCalledOnce();
    const [, context] = mocks.reportErrorClient.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toBe("components/QuestionnaireFlow:transport");
  });

  /**
   * The quota wall is abuse protection working as designed, not a defect — and it already has its
   * own `generation_limit_reached` event from S-06. Reporting it here would make the error stream
   * spike exactly when the system is behaving correctly.
   */
  it("reports nothing when the daily-limit wall refuses the request", async () => {
    stubJson({ ok: false, error: "daily_limit_reached", message: "limit" });

    await postCvGenerate(defaultCvQuestionnaireAnswers);

    expect(mocks.reportErrorClient).not.toHaveBeenCalled();
  });

  it("reports nothing for a generation failure the server already reported", async () => {
    stubJson({ ok: false, error: "service_unavailable", message: "down" });
    await postCvGenerate(defaultCvQuestionnaireAnswers);

    stubJson({ ok: false, error: "generation_failed", message: "bad output" });
    await postCvGenerate(defaultCvQuestionnaireAnswers);

    expect(mocks.reportErrorClient).not.toHaveBeenCalled();
  });

  it("never puts questionnaire answers into the report", async () => {
    const SECRET = "Zxqvbrstmn Unique8675309";
    stubTransportFailure();

    await postCvGenerate({ ...defaultCvQuestionnaireAnswers, fullName: SECRET, experience: SECRET });

    const [, context] = mocks.reportErrorClient.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(JSON.stringify(context)).not.toContain(SECRET);
  });
});
