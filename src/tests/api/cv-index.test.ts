import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Save-collection route contract (F-02, plan phase 2).
 *
 * Characterizes the failure + success envelopes of GET/POST /api/cv — auth (401),
 * body-size guard (413), validation (400), persistence failure (500), and the happy
 * 200/201 — with Supabase and the repository mocked. The registration→app gates sit on
 * this seam, so the status/error-bucket mapping must be locked.
 *
 * Break-to-prove-red (verified, then reverted): dropping the `!context.locals.user`
 * guard in `POST /api/cv` (so it falls through without a user) turns the
 * "POST without a session → 401" test red.
 */

const mocks = vi.hoisted(() => ({
  safeGetUser: vi.fn(),
  createCv: vi.fn(),
  listCvs: vi.fn(),
  track: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({}),
  safeGetUser: mocks.safeGetUser,
}));

vi.mock("@/lib/services/cv-repository", () => ({
  createCv: mocks.createCv,
  listCvs: mocks.listCvs,
}));

vi.mock("@/lib/observability", () => ({
  track: mocks.track,
  reportError: mocks.reportError,
}));

import { GET, POST } from "@/pages/api/cv/index";

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
  cvs?: unknown;
}

async function readJson(response: Response): Promise<Envelope> {
  return (await response.json()) as Envelope;
}

function makeContext(opts: { user: { id: string } | null; request: Request }) {
  return {
    locals: { user: opts.user, observability: { distinctId: "anon-test" }, locale: "en" },
    request: opts.request,
    cookies: {},
    params: {},
  } as never;
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/cv", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.safeGetUser.mockResolvedValue({ id: "user-123" });
  mocks.createCv.mockReset();
  mocks.listCvs.mockReset();
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

describe("POST /api/cv — guards", () => {
  it("rejects an oversized body even when Content-Length is absent (413)", async () => {
    const oversizedBody = JSON.stringify({ payload: "x".repeat(100_001) });
    const request = jsonRequest("POST", {});
    const oversized = new Request(request, { body: oversizedBody });
    oversized.headers.delete("content-length");

    const response = await POST(makeContext({ user: { id: "user-123" }, request: oversized }));

    expect(response.status).toBe(413);
  });

  it("returns 401 without a session and never touches the repository", async () => {
    const response = await POST(makeContext({ user: null, request: jsonRequest("POST", validSavePayload) }));

    expect(response.status).toBe(401);
    expect((await readJson(response)).ok).toBe(false);
    expect(mocks.createCv).not.toHaveBeenCalled();
  });

  /**
   * S-07 "ours, not theirs": user-input and auth rejections are normal traffic, not defects.
   * Reporting them would bury the real failures within a week.
   */
  it("reports nothing for validation, auth, or oversize rejections", async () => {
    const oversized = new Request("http://localhost/api/cv", {
      method: "POST",
      headers: { "Content-Type": "application/json", "content-length": "999999" },
      body: JSON.stringify(validSavePayload),
    });

    await POST(makeContext({ user: null, request: jsonRequest("POST", validSavePayload) })); // 401
    await POST(makeContext({ user: { id: "user-123" }, request: jsonRequest("POST", { foo: 1 }) })); // 400
    await POST(makeContext({ user: { id: "user-123" }, request: oversized })); // 413

    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("returns 400 with a save_failed bucket for an invalid body", async () => {
    const response = await POST(makeContext({ user: { id: "user-123" }, request: jsonRequest("POST", { foo: 1 }) }));

    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("save_failed");
    expect(mocks.createCv).not.toHaveBeenCalled();
  });

  it("returns 500 with a save_failed bucket when persistence throws", async () => {
    mocks.createCv.mockRejectedValue(new Error("db down"));

    const response = await POST(
      makeContext({ user: { id: "user-123" }, request: jsonRequest("POST", validSavePayload) }),
    );

    expect(response.status).toBe(500);
    const body = await readJson(response);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("save_failed");
    expect(mocks.reportError).toHaveBeenCalledOnce();
    expect(reportedLocation()).toBe("api/cv/index:save");
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("returns 201 with the saved summary on success", async () => {
    const summary = { id: "cv-1", title: "My CV", language: "en", createdAt: "now", updatedAt: "now" };
    mocks.createCv.mockResolvedValue(summary);

    const response = await POST(
      makeContext({ user: { id: "user-123" }, request: jsonRequest("POST", validSavePayload) }),
    );

    expect(response.status).toBe(201);
    const body = await readJson(response);
    expect(body.ok).toBe(true);
    expect(body.cv).toEqual(summary);
  });

  it("emits funnel_cv_saved with the request identity on success", async () => {
    mocks.createCv.mockResolvedValue({
      id: "cv-1",
      title: "My CV",
      language: "en",
      createdAt: "now",
      updatedAt: "now",
    });

    await POST(makeContext({ user: { id: "user-123" }, request: jsonRequest("POST", validSavePayload) }));

    expect(mocks.track).toHaveBeenCalledWith("funnel_cv_saved", { locale: "en" }, { distinctId: "anon-test" });
  });
});

describe("GET /api/cv — list", () => {
  it("returns 401 without a session", async () => {
    const response = await GET(makeContext({ user: null, request: new Request("http://localhost/api/cv") }));

    expect(response.status).toBe(401);
    expect(mocks.listCvs).not.toHaveBeenCalled();
  });

  it("returns 500 with a load_failed bucket when the repository throws", async () => {
    mocks.listCvs.mockRejectedValue(new Error("db down"));

    const response = await GET(
      makeContext({ user: { id: "user-123" }, request: new Request("http://localhost/api/cv") }),
    );

    expect(response.status).toBe(500);
    expect((await readJson(response)).error).toBe("load_failed");
    // S-07: the envelope above is unchanged; the report is purely additive.
    expect(mocks.reportError).toHaveBeenCalledOnce();
    expect(reportedLocation()).toBe("api/cv/index:load");
  });

  it("returns 200 with the user's CV summaries", async () => {
    const cvs = [{ id: "cv-1", title: "My CV", language: "en", createdAt: "now", updatedAt: "now" }];
    mocks.listCvs.mockResolvedValue(cvs);

    const response = await GET(
      makeContext({ user: { id: "user-123" }, request: new Request("http://localhost/api/cv") }),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.ok).toBe(true);
    expect(body.cvs).toEqual(cvs);
  });
});
