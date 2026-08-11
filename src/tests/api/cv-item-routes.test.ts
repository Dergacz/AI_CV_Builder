import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, PUT } from "@/pages/api/cv/[id]";
import { deleteCv, getCv, updateCv } from "@/lib/services/cv-repository";
import type { CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

/**
 * Contract tests for `/api/cv/[id]` (F-02 / S-06).
 *
 * The risk these lock down: a request for a CV the caller does not own must be
 * indistinguishable from a request for a CV that does not exist. Anything other than a
 * bare 404 — a 403, a 500 stack, an echoed title — confirms the row exists and leaks
 * which ids belong to other accounts.
 *
 * Owner scoping itself is asserted in `cv-repository.owner-scope.test.ts`; here the
 * repository is mocked to report a miss so only the route's response mapping is under test.
 */

const VIEWER = "22222222-2222-4222-8222-222222222222";
const FOREIGN_CV_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({}),
  safeGetUser: () => Promise.resolve({ id: VIEWER }),
}));

vi.mock("@/lib/services/cv-repository", () => ({
  getCv: vi.fn(),
  updateCv: vi.fn(),
  deleteCv: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  track: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock("@/lib/observability/schedule", () => ({
  scheduleErrorReport: vi.fn(),
}));

const fixtureDraft: unknown = JSON.parse(
  readFileSync("context/changes/generation-export-decision-contract/cv-contract.fixture.json", "utf-8"),
);

const answers: CvQuestionnaireAnswers = {
  fullName: "Ada Lovelace",
  targetRoleOrGoal: "Data Analyst",
  outputLanguage: "en",
  experience: "",
  education: "",
  skillsAndTools: "",
  spokenLanguages: "",
  additionalContext: "",
};

function putRequest(body: unknown): Request {
  return new Request(`http://localhost/api/cv/${FOREIGN_CV_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(id: string, options: { signedIn?: boolean; request?: Request } = {}) {
  const { signedIn = true, request = new Request(`http://localhost/api/cv/${id}`) } = options;
  return {
    locals: { user: signedIn ? { id: VIEWER } : null },
    params: { id },
    request,
    cookies: undefined,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCv).mockResolvedValue(null);
  vi.mocked(updateCv).mockResolvedValue(null);
  vi.mocked(deleteCv).mockResolvedValue(false);
});

describe("a CV owned by another account", () => {
  it("reads as 404 not_found and leaks nothing about the row", async () => {
    const response = await GET(context(FOREIGN_CV_ID));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("not_found");
    expect(body).not.toHaveProperty("cv");
    expect(JSON.stringify(body)).not.toContain("draft");
  });

  it("cannot be overwritten — PUT answers 404, not 403", async () => {
    const response = await PUT(context(FOREIGN_CV_ID, { request: putRequest({ draft: fixtureDraft, answers }) }));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, error: "not_found" });
  });

  it("cannot be deleted — DELETE answers 404, not 403", async () => {
    const response = await DELETE(
      context(FOREIGN_CV_ID, { request: new Request("http://localhost", { method: "DELETE" }) }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, error: "not_found" });
  });
});

describe("request validation", () => {
  it("answers 404 for a malformed id instead of failing with a 500", async () => {
    for (const handler of [GET, DELETE]) {
      const response = await handler(context("not-a-uuid"));
      expect(response.status).toBe(404);
    }
    expect(vi.mocked(getCv)).not.toHaveBeenCalled();
    expect(vi.mocked(deleteCv)).not.toHaveBeenCalled();
  });

  it("rejects an oversized PUT body even when Content-Length is absent", async () => {
    const request = putRequest({ draft: fixtureDraft, answers, title: "x".repeat(100_001) });
    request.headers.delete("content-length");

    const response = await PUT(context(FOREIGN_CV_ID, { request }));

    expect(response.status).toBe(413);
    expect(vi.mocked(updateCv)).not.toHaveBeenCalled();
  });

  it("rejects a payload that does not match the save schema", async () => {
    const response = await PUT(
      context(FOREIGN_CV_ID, { request: putRequest({ draft: { schemaVersion: 1 }, answers }) }),
    );

    expect(response.status).toBe(400);
    expect(vi.mocked(updateCv)).not.toHaveBeenCalled();
  });
});

describe("an unauthenticated request", () => {
  it("answers 401 on every method without touching the repository", async () => {
    expect((await GET(context(FOREIGN_CV_ID, { signedIn: false }))).status).toBe(401);
    expect(
      (await PUT(context(FOREIGN_CV_ID, { signedIn: false, request: putRequest({ draft: fixtureDraft, answers }) })))
        .status,
    ).toBe(401);
    expect((await DELETE(context(FOREIGN_CV_ID, { signedIn: false }))).status).toBe(401);

    expect(vi.mocked(getCv)).not.toHaveBeenCalled();
    expect(vi.mocked(updateCv)).not.toHaveBeenCalled();
    expect(vi.mocked(deleteCv)).not.toHaveBeenCalled();
  });
});
