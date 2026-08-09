import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Generate-route contract: funnel emission (S-01) + the FR-012 abuse guards (S-06).
 *
 * Locks two rules that are easy to regress:
 *   1. `funnel_cv_generated` is emitted ONLY on a successful generation — failures show as
 *      drop-off (absence of the next step), not as a generated event.
 *   2. The quota gate FAILS OPEN. A counter fault, in either direction, must never cost the
 *      user their generation — this is abuse protection, not a paywall.
 *
 * Generation service, Supabase, the quota service, env, and the observability contract are mocked.
 */

const mocks = vi.hoisted(() => ({
  generateCvDraft: vi.fn(),
  track: vi.fn(),
  reportError: vi.fn(),
  createClient: vi.fn(),
  checkGenerationQuota: vi.fn(),
  recordGeneration: vi.fn(),
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
  // The route builds a Supabase client for the quota gate; `createClient` is mocked below, but the
  // module still reads these at import time.
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_KEY: "anon-test",
  GENERATION_DAILY_LIMIT: undefined,
  GENERATION_HOURLY_CEILING: undefined,
}));

vi.mock("@/lib/services/cv-generation", () => ({ generateCvDraft: mocks.generateCvDraft }));

vi.mock("@/lib/observability", () => ({ track: mocks.track, reportError: mocks.reportError }));

vi.mock("@/lib/supabase", () => ({ createClient: mocks.createClient }));

vi.mock("@/lib/services/generation-quota", () => ({
  checkGenerationQuota: mocks.checkGenerationQuota,
  recordGeneration: mocks.recordGeneration,
  getGenerationLimits: () => ({ dailyLimit: 100, hourlyCeiling: 500 }),
}));

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

const SUPABASE_STUB = { rpc: vi.fn() };

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

/** Find a tracked event by name; the gate emits before the funnel event, so index is not stable. */
function expectTrackedEvent(name: string): [string, Record<string, unknown>, unknown] {
  const call = mocks.track.mock.calls.find((entry) => entry[0] === name) as
    | [string, Record<string, unknown>, unknown]
    | undefined;
  if (!call) {
    throw new Error(`expected a "${name}" event to be tracked`);
  }
  return call;
}

beforeEach(() => {
  mocks.apiKey = "sk-test";
  mocks.generateCvDraft.mockReset();
  mocks.track.mockReset();
  mocks.reportError.mockReset();
  mocks.checkGenerationQuota.mockReset();
  mocks.recordGeneration.mockReset();
  mocks.createClient.mockReset();

  // Default posture: Supabase available, under both limits, recording succeeds.
  mocks.createClient.mockReturnValue(SUPABASE_STUB);
  mocks.checkGenerationQuota.mockResolvedValue("ok");
  mocks.recordGeneration.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cv/generate — funnel emission", () => {
  it("emits funnel_cv_generated with coarse metadata on a successful generation", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(200);
    const [, props, identity] = expectTrackedEvent("funnel_cv_generated");
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

    expect(expectTrackedEvent("funnel_cv_generated")[1].generation_event_id).toBe(body.generationEventId);
  });

  it("does not emit when generation fails", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: false, error: "generation_failed", message: "nope" });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(422);
    expect(mocks.track).not.toHaveBeenCalled();
  });

  /**
   * S-07 p3 wiring. The service owns *which* mode failed; the route owns identity and scheduling.
   * The service's own tests cannot see this seam, so it is asserted here.
   */
  it("passes a reporter that forwards the service's location and identity to reportError", async () => {
    mocks.generateCvDraft.mockImplementation(
      (_answers: unknown, config: { reportFailure?: (e: unknown, l: string, p?: object) => void }) => {
        config.reportFailure?.(new Error("upstream"), "services/cv-generation:providerResponse", { status: 503 });
        return Promise.resolve({ ok: false, error: "service_unavailable", message: "nope" });
      },
    );

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(503);
    // Exactly one report: the service named the cause, so the route must NOT add a second on the
    // `!result.ok` branch — double-reporting would make failure rates meaningless.
    expect(mocks.reportError).toHaveBeenCalledOnce();
    const [, context, identity] = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(context.error_location).toBe("services/cv-generation:providerResponse");
    expect(context.status).toBe(503);
    expect(identity).toEqual({ distinctId: "anon-test" });
  });

  it("reports nothing on a successful generation", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });

    await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  it("does not emit without a session", async () => {
    const response = await POST(makeContext({ user: null, body: validAnswers }));

    expect(response.status).toBe(401);
    expect(mocks.generateCvDraft).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});

describe("POST /api/cv/generate — daily limit + aggregate guard (FR-012)", () => {
  it("refuses with 429 and the daily_limit_reached bucket when the per-user cap is reached", async () => {
    mocks.checkGenerationQuota.mockResolvedValue("user_daily");

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("daily_limit_reached");
    expect(body.message).toBeTruthy();
  });

  it("refuses with 503 and the ordinary service_unavailable bucket when the hourly ceiling is hit", async () => {
    mocks.checkGenerationQuota.mockResolvedValue("global_hourly");

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));
    const body = (await response.json()) as Record<string, unknown>;

    // Deliberately indistinguishable from an outage: it must not confirm the global ceiling exists.
    expect(response.status).toBe(503);
    expect(body.error).toBe("service_unavailable");
    expect(body.error).not.toBe("global_hourly");
  });

  it.each([
    { verdict: "user_daily", status: 429 },
    { verdict: "global_hourly", status: 503 },
  ])("spends nothing on the provider when refused ($verdict)", async ({ verdict, status }) => {
    mocks.checkGenerationQuota.mockResolvedValue(verdict);

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(status);
    expect(mocks.generateCvDraft).not.toHaveBeenCalled();
    expect(mocks.recordGeneration).not.toHaveBeenCalled();
  });

  it.each(["user_daily", "global_hourly"])("emits generation_limit_reached with limit_kind=%s", async (verdict) => {
    mocks.checkGenerationQuota.mockResolvedValue(verdict);

    await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    const [, props, identity] = expectTrackedEvent("generation_limit_reached");
    // Content-free by contract: only the guard that fired and the UI locale.
    expect(props).toEqual({ limit_kind: verdict, locale: "en" });
    expect(identity).toEqual({ distinctId: "anon-test" });
  });

  it("refuses before the provider-key check, so a missing key still yields the daily-limit wall", async () => {
    // Ordering guard: this is what lets the E2E prove the wall with no OpenAI key and no spend.
    mocks.apiKey = "";
    mocks.checkGenerationQuota.mockResolvedValue("user_daily");

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(body.error).toBe("daily_limit_reached");
  });

  it("fails OPEN when the quota check throws — generation proceeds and the fault is reported", async () => {
    mocks.checkGenerationQuota.mockRejectedValue(new Error("connection refused"));
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(200);
    expect(mocks.generateCvDraft).toHaveBeenCalledTimes(1);
    expect(mocks.reportError).toHaveBeenCalledTimes(1);
    const [, context] = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toContain("checkGenerationQuota");
  });

  it("skips the gate entirely when Supabase is unconfigured", async () => {
    mocks.createClient.mockReturnValue(null);
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(200);
    expect(mocks.checkGenerationQuota).not.toHaveBeenCalled();
    expect(mocks.recordGeneration).not.toHaveBeenCalled();
  });

  it("records exactly one usage row on a successful generation", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });

    await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(mocks.recordGeneration).toHaveBeenCalledTimes(1);
  });

  it("does not record when generation fails — users are never charged for our failures", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: false, error: "generation_failed", message: "nope" });

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(422);
    expect(mocks.recordGeneration).not.toHaveBeenCalled();
  });

  it("still returns the draft when recording throws — bookkeeping never destroys finished work", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });
    mocks.recordGeneration.mockRejectedValue(new Error("connection refused"));

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.draft).toBeTruthy();
    const [, context] = mocks.reportError.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(context.error_location).toContain("recordGeneration");
  });

  it("returns the draft even when the cap refused the insert (concurrent request won the slot)", async () => {
    mocks.generateCvDraft.mockResolvedValue({ ok: true, draft: { sections: {} } });
    mocks.recordGeneration.mockResolvedValue(false);

    const response = await POST(makeContext({ user: { id: "user-123" }, body: validAnswers }));

    expect(response.status).toBe(200);
    expect(mocks.reportError).not.toHaveBeenCalled();
  });
});
