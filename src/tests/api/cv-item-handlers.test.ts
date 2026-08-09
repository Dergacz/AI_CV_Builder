import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Save-item route contract (F-02, plan phase 2).
 *
 * Characterizes the failure + success envelopes of GET/PUT/DELETE /api/cv/[id] —
 * auth (401), malformed/not-found id (404), validation (400), persistence failure
 * (500), and the happy 200 — with Supabase and the repository mocked. These are the
 * reopen/update/delete seams the registration→app gates must not perturb.
 *
 * Break-to-prove-red (verified, then reverted): making `GET /api/cv/[id]` return the
 * loaded CV without the `if (!cv)` null check turns the
 * "GET a missing CV → 404" test red.
 */

const mocks = vi.hoisted(() => ({
  safeGetUser: vi.fn(),
  getCv: vi.fn(),
  updateCv: vi.fn(),
  deleteCv: vi.fn(),
  track: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({}),
  safeGetUser: mocks.safeGetUser,
}));

vi.mock("@/lib/services/cv-repository", () => ({
  getCv: mocks.getCv,
  updateCv: mocks.updateCv,
  deleteCv: mocks.deleteCv,
}));

vi.mock("@/lib/observability", () => ({
  track: mocks.track,
  reportError: mocks.reportError,
}));

import { DELETE, GET, PUT } from "@/pages/api/cv/[id]";

const VALID_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const fixtureDraft = JSON.parse(
  readFileSync("context/changes/generation-export-decision-contract/cv-contract.fixture.json", "utf-8"),
) as unknown;

const validAnswers = {
  fullName: "Ada Lovelace",
  targetRoleOrGoal: "Data Analyst",
  outputLanguage: "en",
  experience: "",
  education: "",
  skillsAndTools: "",
  spokenLanguages: "",
  additionalContext: "",
};

const validSavePayload = { title: "My CV", draft: fixtureDraft, answers: validAnswers };

interface Envelope {
  ok: boolean;
  error?: string;
  message?: string;
  cv?: unknown;
}

async function readJson(response: Response): Promise<Envelope> {
  return (await response.json()) as Envelope;
}

function makeContext(opts: { user: { id: string } | null; id?: string; request?: Request }) {
  return {
    locals: { user: opts.user, observability: { distinctId: "anon-test" }, locale: "en" },
    request: opts.request ?? new Request(`http://localhost/api/cv/${opts.id ?? VALID_ID}`),
    cookies: {},
    params: { id: opts.id ?? VALID_ID },
  } as never;
}

function putRequest(body: unknown): Request {
  return new Request(`http://localhost/api/cv/${VALID_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.safeGetUser.mockResolvedValue({ id: "user-123" });
  mocks.getCv.mockReset();
  mocks.updateCv.mockReset();
  mocks.deleteCv.mockReset();
  mocks.track.mockReset();
  mocks.reportError.mockReset();
});

/** Helper: the error_location of the single report a test expects. */
function reportedLocation(): string {
  const call = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>] | undefined;
  if (!call) {
    throw new Error("expected exactly one error report");
  }
  return call[1].error_location as string;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/cv/[id]", () => {
  it("returns 401 without a session and never touches the repository", async () => {
    const response = await GET(makeContext({ user: null }));

    expect(response.status).toBe(401);
    expect(mocks.getCv).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed (non-uuid) id without touching the repository", async () => {
    const response = await GET(makeContext({ user: { id: "user-123" }, id: "not-a-uuid" }));

    expect(response.status).toBe(404);
    expect((await readJson(response)).error).toBe("not_found");
    expect(mocks.getCv).not.toHaveBeenCalled();
  });

  it("returns 404 with a not_found bucket when the CV is missing", async () => {
    mocks.getCv.mockResolvedValue(null);

    const response = await GET(makeContext({ user: { id: "user-123" } }));

    expect(response.status).toBe(404);
    expect((await readJson(response)).error).toBe("not_found");
  });

  it("returns 500 with a load_failed bucket when the repository throws", async () => {
    mocks.getCv.mockRejectedValue(new Error("db down"));

    const response = await GET(makeContext({ user: { id: "user-123" } }));

    expect(response.status).toBe(500);
    expect((await readJson(response)).error).toBe("load_failed");
    // S-07: the envelope above is unchanged; the report is purely additive.
    expect(mocks.reportError).toHaveBeenCalledOnce();
    expect(reportedLocation()).toBe("api/cv/[id]:load");
  });

  it("returns 200 with the loaded CV on success", async () => {
    const cv = { id: VALID_ID, title: "My CV" };
    mocks.getCv.mockResolvedValue(cv);

    const response = await GET(makeContext({ user: { id: "user-123" } }));

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.ok).toBe(true);
    expect(body.cv).toEqual(cv);
  });
});

describe("PUT /api/cv/[id]", () => {
  it("returns 401 without a session", async () => {
    const response = await PUT(makeContext({ user: null, request: putRequest(validSavePayload) }));

    expect(response.status).toBe(401);
    expect(mocks.updateCv).not.toHaveBeenCalled();
  });

  it("returns 400 with a save_failed bucket for an invalid body", async () => {
    const response = await PUT(makeContext({ user: { id: "user-123" }, request: putRequest({ foo: 1 }) }));

    expect(response.status).toBe(400);
    expect((await readJson(response)).error).toBe("save_failed");
    expect(mocks.updateCv).not.toHaveBeenCalled();
  });

  it("returns 404 with a not_found bucket when the update target is missing", async () => {
    mocks.updateCv.mockResolvedValue(null);

    const response = await PUT(makeContext({ user: { id: "user-123" }, request: putRequest(validSavePayload) }));

    expect(response.status).toBe(404);
    expect((await readJson(response)).error).toBe("not_found");
  });

  it("returns 500 with a save_failed bucket when persistence throws", async () => {
    mocks.updateCv.mockRejectedValue(new Error("db down"));

    const response = await PUT(makeContext({ user: { id: "user-123" }, request: putRequest(validSavePayload) }));

    expect(response.status).toBe(500);
    expect((await readJson(response)).error).toBe("save_failed");
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.reportError).toHaveBeenCalledOnce();
    expect(reportedLocation()).toBe("api/cv/[id]:save");
  });

  it("returns 200 with the updated summary on success", async () => {
    const summary = { id: VALID_ID, title: "My CV", language: "en", createdAt: "now", updatedAt: "now" };
    mocks.updateCv.mockResolvedValue(summary);

    const response = await PUT(makeContext({ user: { id: "user-123" }, request: putRequest(validSavePayload) }));

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.ok).toBe(true);
    expect(body.cv).toEqual(summary);
  });

  it("emits funnel_cv_saved with the request identity on a successful update", async () => {
    mocks.updateCv.mockResolvedValue({
      id: VALID_ID,
      title: "My CV",
      language: "en",
      createdAt: "now",
      updatedAt: "now",
    });

    await PUT(makeContext({ user: { id: "user-123" }, request: putRequest(validSavePayload) }));

    expect(mocks.track).toHaveBeenCalledWith("funnel_cv_saved", { locale: "en" }, { distinctId: "anon-test" });
  });

  it("does not emit funnel_cv_saved when the update target is missing", async () => {
    mocks.updateCv.mockResolvedValue(null);

    await PUT(makeContext({ user: { id: "user-123" }, request: putRequest(validSavePayload) }));

    expect(mocks.track).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/cv/[id]", () => {
  it("returns 401 without a session", async () => {
    const response = await DELETE(makeContext({ user: null }));

    expect(response.status).toBe(401);
    expect(mocks.deleteCv).not.toHaveBeenCalled();
  });

  it("returns 404 with a not_found bucket when nothing was deleted", async () => {
    mocks.deleteCv.mockResolvedValue(false);

    const response = await DELETE(makeContext({ user: { id: "user-123" } }));

    expect(response.status).toBe(404);
    expect((await readJson(response)).error).toBe("not_found");
  });

  it("returns 500 with a delete_failed bucket when the repository throws", async () => {
    mocks.deleteCv.mockRejectedValue(new Error("db down"));

    const response = await DELETE(makeContext({ user: { id: "user-123" } }));

    expect(response.status).toBe(500);
    expect((await readJson(response)).error).toBe("delete_failed");
    expect(mocks.reportError).toHaveBeenCalledOnce();
    expect(reportedLocation()).toBe("api/cv/[id]:delete");
  });

  /**
   * S-07 "ours, not theirs": a 404 for a CV that is missing or not owned is a normal outcome —
   * and on the not-owned path, reporting would also make the monitor a probe oracle.
   */
  it("reports nothing for a missing/not-owned CV or a malformed id", async () => {
    mocks.deleteCv.mockResolvedValue(false);

    await DELETE(makeContext({ user: { id: "user-123" } })); // 404 — not found / not owned
    await DELETE(makeContext({ user: { id: "user-123" }, id: "not-a-uuid" })); // 404 — malformed id
    await DELETE(makeContext({ user: null })); // 401

    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("returns 200 on a successful delete", async () => {
    mocks.deleteCv.mockResolvedValue(true);

    const response = await DELETE(makeContext({ user: { id: "user-123" } }));

    expect(response.status).toBe(200);
    expect((await readJson(response)).ok).toBe(true);
  });
});
