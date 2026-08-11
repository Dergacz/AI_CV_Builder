import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * S-07 p4: client transport reporting for the generate seam — the most valuable client report in
 * the slice.
 *
 * Every failure the SERVER sees is already reported by p3 with its precise mode. This covers the
 * one case nothing else in the system sees: the request never landed, or its answer never arrived,
 * leaving the entire AI surface dark on both sides. Non-ok envelopes are deliberately NOT reported
 * here — including the 429 daily-limit wall, which is abuse protection working as designed and
 * already carries its own `generation_limit_reached` event from S-06.
 */

const mocks = vi.hoisted(() => ({
  reportErrorClient: vi.fn(),
}));

vi.mock("@/lib/observability/client.browser", () => ({
  reportErrorClient: mocks.reportErrorClient,
  trackClient: vi.fn(),
}));

import { postCvGenerate } from "@/components/cv/QuestionnaireFlow";
import { defaultCvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

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

describe("postCvGenerate", () => {
  it("reports once when the request never reaches the server", async () => {
    stubTransportFailure();

    expect(await postCvGenerate(defaultCvQuestionnaireAnswers)).toBeNull();
    expect(mocks.reportErrorClient).toHaveBeenCalledOnce();
    const [, context] = mocks.reportErrorClient.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toBe("components/QuestionnaireFlow:transport");
  });

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

  it("reports nothing on a successful generation", async () => {
    stubJson({ ok: true, draft: { sections: {} }, generationEventId: "evt-1" });

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
