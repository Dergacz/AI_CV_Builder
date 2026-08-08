import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/cv/feedback — contract tests (S-05 / FR-010).
 *
 * Locks the privacy invariant (comment never reaches track()), the auth gate,
 * input validation, upsert path, and fail-soft error responses.
 */

const mocks = vi.hoisted(() => ({
  upsertFeedback: vi.fn(),
  track: vi.fn(),
  reportError: vi.fn(),
  safeGetUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/services/feedback-repository", () => ({ upsertFeedback: mocks.upsertFeedback }));
vi.mock("@/lib/observability", () => ({ track: mocks.track, reportError: mocks.reportError }));
vi.mock("@/lib/supabase", () => ({
  createClient: mocks.createClient,
  safeGetUser: mocks.safeGetUser,
}));

import { POST } from "@/pages/api/cv/feedback";

const VALID_EVENT_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeContext(opts: { user: { id: string } | null; body: unknown }) {
  return {
    locals: {
      user: opts.user,
      observability: { distinctId: "anon-test" },
      locale: "en" as const,
    },
    request: new Request("http://localhost/api/cv/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts.body),
    }),
    cookies: {},
  } as never;
}

beforeEach(() => {
  mocks.upsertFeedback.mockResolvedValue(undefined);
  mocks.track.mockResolvedValue(undefined);
  mocks.createClient.mockReturnValue({});
  mocks.safeGetUser.mockResolvedValue({ id: "user-123" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cv/feedback", () => {
  it("returns 401 when no session", async () => {
    const res = await POST(makeContext({ user: null, body: {} }));
    expect(res.status).toBe(401);
    expect(mocks.upsertFeedback).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid body — missing helpful", async () => {
    const res = await POST(makeContext({ user: { id: "u1" }, body: { generationEventId: VALID_EVENT_ID } }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("feedback_failed");
  });

  it("returns 400 for invalid body — bad UUID", async () => {
    const res = await POST(
      makeContext({ user: { id: "u1" }, body: { generationEventId: "not-a-uuid", helpful: true } }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid body — comment exceeds 1000 chars", async () => {
    const res = await POST(
      makeContext({
        user: { id: "u1" },
        body: { generationEventId: VALID_EVENT_ID, helpful: true, comment: "x".repeat(1001) },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts and returns { ok: true } for a valid submission", async () => {
    const res = await POST(
      makeContext({
        user: { id: "u1" },
        body: { generationEventId: VALID_EVENT_ID, helpful: true, comment: "Great!" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(mocks.upsertFeedback).toHaveBeenCalledWith(expect.anything(), "user-123", {
      generationEventId: VALID_EVENT_ID,
      helpful: true,
      comment: "Great!",
    });
  });

  it("upserts without comment when comment is whitespace-only", async () => {
    await POST(
      makeContext({
        user: { id: "u1" },
        body: { generationEventId: VALID_EVENT_ID, helpful: false, comment: "   " },
      }),
    );
    expect(mocks.upsertFeedback).toHaveBeenCalledWith(expect.anything(), "user-123", {
      generationEventId: VALID_EVENT_ID,
      helpful: false,
      comment: undefined,
    });
  });

  it("never forwards comment to track() — privacy invariant", async () => {
    await POST(
      makeContext({
        user: { id: "u1" },
        body: { generationEventId: VALID_EVENT_ID, helpful: true, comment: "raw user text" },
      }),
    );
    expect(mocks.track).toHaveBeenCalledOnce();
    const [event, props] = mocks.track.mock.calls[0] as [string, Record<string, unknown>];
    expect(event).toBe("feedback_submitted");
    expect(props).not.toHaveProperty("comment");
    expect(props.helpful).toBe(true);
    expect(props.generation_event_id).toBe(VALID_EVENT_ID);
    expect(props.locale).toBe("en");
  });

  it("emits feedback_submitted with only allowlisted keys", async () => {
    await POST(
      makeContext({
        user: { id: "u1" },
        body: { generationEventId: VALID_EVENT_ID, helpful: false },
      }),
    );
    const [, props] = mocks.track.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(props).sort()).toEqual(["generation_event_id", "helpful", "locale"]);
  });

  it("returns 500 and does not track when upsert throws", async () => {
    mocks.upsertFeedback.mockRejectedValue(new Error("db error"));
    const res = await POST(
      makeContext({
        user: { id: "u1" },
        body: { generationEventId: VALID_EVENT_ID, helpful: true },
      }),
    );
    expect(res.status).toBe(500);
    expect(mocks.track).not.toHaveBeenCalled();
    // S-07: fail-soft for the user, but a persistent store failure is still our defect. The
    // envelope is unchanged; only the report is new — and it carries no comment.
    expect(mocks.reportError).toHaveBeenCalledOnce();
    const [, reported] = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(reported.error_location).toBe("api/cv/feedback:store");
  });

  it("reports nothing when feedback is rejected for validation or auth", async () => {
    await POST(makeContext({ user: null, body: {} })); // 401
    await POST(makeContext({ user: { id: "u1" }, body: { helpful: "yes" } })); // 400

    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("returns 503 when supabase client is unavailable", async () => {
    mocks.createClient.mockReturnValue(null);
    const res = await POST(
      makeContext({
        user: { id: "u1" },
        body: { generationEventId: VALID_EVENT_ID, helpful: true },
      }),
    );
    expect(res.status).toBe(503);
  });
});
