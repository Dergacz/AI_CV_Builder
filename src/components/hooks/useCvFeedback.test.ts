import { afterEach, describe, expect, it, vi } from "vitest";

import { postCvFeedback } from "@/components/hooks/useCvFeedback";

/**
 * Submit-path contract for the post-generation feedback widget (S-05, plan phase 3).
 *
 * Covers the network seam the widget sits on: the exact body posted to
 * /api/cv/feedback, the optional comment, and fail-soft behaviour on every failure
 * mode. The React shell around it (`useCvFeedback` / `CvFeedback`) only maps the
 * boolean returned here onto status + localized retry copy.
 */

const GENERATION_EVENT_ID = "11111111-1111-4111-8111-111111111111";

// `init` is declared required: postCvFeedback always passes one, and this keeps the
// recorded call tuple free of assertions when the tests read the posted body back.
type FetchSignature = (input: RequestInfo | URL, init: RequestInit) => Promise<Response>;
type FetchMock = ReturnType<typeof vi.fn<FetchSignature>>;

function mockFetch(response: { ok?: boolean; json?: unknown; reject?: boolean }): FetchMock {
  const fetchMock = vi.fn<FetchSignature>(() => {
    if (response.reject) return Promise.reject(new Error("network down"));
    return Promise.resolve({
      ok: response.ok ?? true,
      json: () => Promise.resolve(response.json ?? { ok: true }),
    } as unknown as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(fetchMock: FetchMock): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postCvFeedback", () => {
  it("posts the verdict, generation event id, and comment to /api/cv/feedback", async () => {
    const fetchMock = mockFetch({});

    const ok = await postCvFeedback({
      generationEventId: GENERATION_EVENT_ID,
      helpful: true,
      comment: "Solid summary section.",
    });

    expect(ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/cv/feedback");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(bodyOf(fetchMock)).toEqual({
      generationEventId: GENERATION_EVENT_ID,
      helpful: true,
      comment: "Solid summary section.",
    });
  });

  it("carries a negative verdict unchanged", async () => {
    const fetchMock = mockFetch({});

    await postCvFeedback({ generationEventId: GENERATION_EVENT_ID, helpful: false });

    expect(bodyOf(fetchMock).helpful).toBe(false);
  });

  it("omits the comment when it is absent or blank", async () => {
    const withoutComment = mockFetch({});
    await postCvFeedback({ generationEventId: GENERATION_EVENT_ID, helpful: true });
    expect(bodyOf(withoutComment)).not.toHaveProperty("comment");
    vi.unstubAllGlobals();

    const blankComment = mockFetch({});
    await postCvFeedback({ generationEventId: GENERATION_EVENT_ID, helpful: true, comment: "   \n  " });
    expect(bodyOf(blankComment)).not.toHaveProperty("comment");
  });

  it("resolves false when the server rejects the submission", async () => {
    mockFetch({ ok: false, json: { ok: false, error: "feedback_failed", message: "nope" } });

    await expect(postCvFeedback({ generationEventId: GENERATION_EVENT_ID, helpful: true })).resolves.toBe(false);
  });

  it("resolves false instead of throwing when the network fails", async () => {
    mockFetch({ reject: true });

    await expect(postCvFeedback({ generationEventId: GENERATION_EVENT_ID, helpful: false })).resolves.toBe(false);
  });
});
