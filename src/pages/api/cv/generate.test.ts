import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Generate-route funnel emission (S-01, plan phase 2).
 *
 * Locks the rule that `funnel_cv_generated` is emitted ONLY on a successful generation — failures
 * show as drop-off (absence of the next step), not as a generated event. Generation service + env
 * + the observability contract are mocked.
 */

const mocks = vi.hoisted(() => ({
  generateCvDraft: vi.fn(),
  track: vi.fn(),
  apiKey: "sk-test",
  model: "gpt-4o-mini",
}));

vi.mock("astro:env/server", () => ({
  get OPENAI_API_KEY() {
    return mocks.apiKey;
  },
  get OPENAI_MODEL() {
    return mocks.model;
  },
}));

vi.mock("@/lib/services/cv-generation", () => ({ generateCvDraft: mocks.generateCvDraft }));

vi.mock("@/lib/observability", () => ({ track: mocks.track }));

import { POST } from "@/pages/api/cv/generate";

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

function makeContext(opts: { user: { id: string } | null; body: unknown }) {
  return {
    locals: { user: opts.user, observability: { distinctId: "anon-test" }, locale: "en" },
    request: new Request("http://localhost/api/cv/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts.body),
    }),
    cookies: {},
  } as never;
}

beforeEach(() => {
  mocks.apiKey = "sk-test";
  mocks.generateCvDraft.mockReset();
  mocks.track.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cv/generate — funnel emission", () => {
  it("emits funnel_cv_generated with coarse metadata on a successful generation", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(200);
    const [event, props, identity] = mocks.track.mock.calls[0] as [string, Record<string, unknown>, unknown];
    expect(event).toBe("funnel_cv_generated");
    expect(props).toMatchObject({ locale: "en", model_provider: "openai", success: true });
    expect(typeof props.duration_ms).toBe("number");
    expect(identity).toEqual({ distinctId: "anon-test" });
  });

  it("returns generationEventId in the 200 body and includes it in the funnel event", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(typeof body.generationEventId).toBe("string");
    expect((body.generationEventId as string).length).toBeGreaterThan(0);

    const [, props] = mocks.track.mock.calls[0] as [string, Record<string, unknown>];
    expect(props.generation_event_id).toBe(body.generationEventId);
  });

  it("does not emit when generation fails", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: false, error: "generation_failed", message: "nope" });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(422);
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("does not emit without a session", async () => {
    const response = await POST(makeContext({ user: null, body: validAnswers }));

    expect(response.status).toBe(401);
    expect(mocks.generateCvDraft).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
