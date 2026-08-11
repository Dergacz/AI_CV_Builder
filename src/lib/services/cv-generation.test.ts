import { afterEach, describe, expect, it, vi } from "vitest";

import { generateCvDraft, type GenerationFailureReporter } from "@/lib/services/cv-generation";
import { generationErrorMessages, type GenerateDraftResponse } from "@/lib/cv-draft";
import { QUESTIONNAIRE_VERSION, type CvOutputLanguage, type CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";

/**
 * Generation-service contract (F-02, plan phase 1).
 *
 * Characterizes `generateCvDraft` with the OpenAI HTTP call stubbed: the happy-path
 * server-side stamping + null-stripping, every failure-bucket mapping, prompt assembly,
 * and the no-raw-content privacy rule. This is the contract S-06 (daily limit) layers on.
 *
 * Break-to-prove-red (verified, then reverted): flipping the non-ok branch in
 * `cv-generation.ts` from `unavailable()` to `genFailed()` turns the
 * "provider non-ok response → service_unavailable" test red — proving the bucket
 * mapping is genuinely guarded.
 */

// A distinctive answers payload — the secret strings below must never surface in any
// returned envelope (privacy invariant: the service must not echo raw answers).
const SECRET_NAME = "Zxqvbrstmn Unique8675309";
const SECRET_EXPERIENCE = "Confidential-Employer-Quux-Detail";

function buildAnswers(outputLanguage: CvOutputLanguage = "en"): CvQuestionnaireAnswers {
  return {
    fullName: SECRET_NAME,
    targetRoleOrGoal: "Customer Support Specialist",
    outputLanguage,
    experience: SECRET_EXPERIENCE,
    education: "General studies",
    skillsAndTools: "Email, spreadsheets",
    spokenLanguages: "English",
    additionalContext: "",
  };
}

/**
 * The content the model returns — only `sections`/`assumptions`/`warnings`; the service
 * stamps `schemaVersion`/`language`/`source`. Nulls here exercise `stripNulls`.
 */
function buildModelContent() {
  return {
    sections: {
      summary: { headline: null, body: "Reliable, people-first support professional." },
      experience: [
        {
          role: "Customer Support Volunteer",
          organization: "Community Help Desk",
          location: null,
          startDate: null,
          endDate: null,
          isCurrent: null,
          description: "Answered questions over chat and email.",
          highlights: ["Resolved everyday requests end to end"],
        },
      ],
      education: [
        {
          institution: "Community College",
          program: "General studies",
          location: null,
          startDate: null,
          endDate: null,
          description: null,
        },
      ],
      skills: [{ label: "Core strengths", items: ["Customer communication", "Teamwork"] }],
      languages: [{ name: "English", proficiency: null }],
    },
    assumptions: [],
    warnings: [],
  };
}

/** Build a stubbed OpenAI chat-completions Response carrying `message` as the choice. */
function okResponse(message: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchImpl = (url: string, init: RequestInit) => Response | Promise<Response>;

function stubFetch(impl: FetchImpl) {
  const fetchMock = vi.fn<FetchImpl>(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

interface OpenAiRequestBody {
  model: string;
  messages: { role: string; content: string }[];
  response_format?: { type: string };
}

/**
 * Stub fetch with a successful draft response while capturing the request the service
 * sent, so tests can assert prompt assembly without poking at `mock.calls` typing.
 */
function recordingStub(): { getUrl: () => string; getRequest: () => OpenAiRequestBody } {
  let captured: { url: string; body: OpenAiRequestBody } | undefined;
  stubFetch((url, init) => {
    const raw = typeof init.body === "string" ? init.body : "{}";
    captured = { url, body: JSON.parse(raw) as OpenAiRequestBody };
    return okResponse({ content: JSON.stringify(buildModelContent()) });
  });
  return {
    getUrl: () => {
      if (!captured) throw new Error("fetch was not called");
      return captured.url;
    },
    getRequest: () => {
      if (!captured) throw new Error("fetch was not called");
      return captured.body;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("generateCvDraft — happy path", () => {
  it("stamps server-owned fields, strips nulls, and returns the validated draft", async () => {
    const fetchMock = stubFetch(() => okResponse({ content: JSON.stringify(buildModelContent()) }));

    const result = await generateCvDraft(buildAnswers("pl"), { apiKey: "sk-test", model: "gpt-test-model" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.schemaVersion).toBe(1);
    expect(result.draft.language).toBe("pl");
    expect(result.draft.source.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
    expect(result.draft.source.modelProvider).toBe("openai");
    expect(result.draft.source.modelName).toBe("gpt-test-model");
    // stripNulls removed the null-valued optional keys before validation.
    expect(result.draft.sections.summary.headline).toBeUndefined();
    expect(result.draft.sections.experience[0]?.location).toBeUndefined();
    expect(result.draft.sections.languages[0]?.proficiency).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("defaults the model name to gpt-4o-mini when none is supplied", async () => {
    const recorder = recordingStub();

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.source.modelName).toBe("gpt-4o-mini");
    expect(recorder.getRequest().model).toBe("gpt-4o-mini");
  });
});

describe("generateCvDraft — failure buckets", () => {
  it("returns service_unavailable when the API key is missing, without calling fetch", async () => {
    const fetchMock = stubFetch(() => okResponse({ content: "{}" }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "" });

    expect(result).toEqual<GenerateDraftResponse>({
      ok: false,
      error: "service_unavailable",
      message: generationErrorMessages.service_unavailable,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a network/abort error to service_unavailable", async () => {
    stubFetch(() => {
      throw new DOMException("aborted", "AbortError");
    });

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("service_unavailable");
  });

  it("maps an unparseable provider response body to service_unavailable", async () => {
    // 200 with a non-JSON body: `response.json()` throws inside the parse try.
    stubFetch(() => new Response("<html>gateway</html>", { status: 200 }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("service_unavailable");
  });

  it("maps a provider non-ok response to service_unavailable", async () => {
    stubFetch(() => new Response("upstream error", { status: 500 }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("service_unavailable");
  });

  it("maps a model refusal to generation_failed", async () => {
    stubFetch(() => okResponse({ refusal: "I can't help with that", content: null }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("generation_failed");
  });

  it("maps empty/missing content to generation_failed", async () => {
    stubFetch(() => okResponse({ content: "" }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("generation_failed");
  });

  it("maps invalid JSON content to generation_failed", async () => {
    stubFetch(() => okResponse({ content: "this is not json" }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("generation_failed");
  });

  it("maps schema-nonconforming content to generation_failed", async () => {
    // summary.body is blank — violates the required-text contract in generatedCvDraftSchema.
    const badContent = {
      sections: { summary: { body: "" }, experience: [], education: [], skills: [], languages: [] },
      assumptions: [],
      warnings: [],
    };
    stubFetch(() => okResponse({ content: JSON.stringify(badContent) }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("generation_failed");
  });
});

/**
 * S-07 phase 3. Before this, a total OpenAI outage produced ZERO error signal — only the absence
 * of `funnel_cv_generated`, which S-01 explicitly deferred here. The point is not merely that
 * failures are reported, but that the seven modes stay *distinguishable*: at 3am the question is
 * "is the provider down, or is the model returning garbage?", and the two user-facing buckets
 * cannot answer it.
 */
describe("generateCvDraft — failure reporting", () => {
  interface Reported {
    error: unknown;
    location: string;
    props?: { status?: number };
  }

  function recordingReporter(): { calls: Reported[]; report: GenerationFailureReporter } {
    const calls: Reported[] = [];
    return {
      calls,
      report: (error, location, props) => {
        calls.push({ error, location, props });
      },
    };
  }

  it.each([
    {
      mode: "network/timeout/abort",
      stub: () => {
        throw new DOMException("aborted", "AbortError");
      },
      location: "services/cv-generation:providerFetch",
      bucket: "service_unavailable",
    },
    {
      mode: "provider non-ok",
      stub: () => new Response("upstream error", { status: 503 }),
      location: "services/cv-generation:providerResponse",
      bucket: "service_unavailable",
    },
    {
      mode: "response-JSON parse",
      stub: () => new Response("<html>gateway</html>", { status: 200 }),
      location: "services/cv-generation:responseParse",
      bucket: "service_unavailable",
    },
    {
      mode: "model refusal",
      stub: () => okResponse({ refusal: "I can't help with that", content: null }),
      location: "services/cv-generation:modelRefusal",
      bucket: "generation_failed",
    },
    {
      mode: "empty content",
      stub: () => okResponse({ content: "" }),
      location: "services/cv-generation:emptyContent",
      bucket: "generation_failed",
    },
    {
      mode: "content-JSON parse",
      stub: () => okResponse({ content: "this is not json" }),
      location: "services/cv-generation:contentParse",
      bucket: "generation_failed",
    },
    {
      mode: "schema mismatch",
      stub: () =>
        okResponse({
          content: JSON.stringify({
            sections: { summary: { body: "" }, experience: [], education: [], skills: [], languages: [] },
            assumptions: [],
            warnings: [],
          }),
        }),
      location: "services/cv-generation:schemaMismatch",
      bucket: "generation_failed",
    },
  ])("reports $mode at its own location without changing the bucket", async ({ stub, location, bucket }) => {
    stubFetch(stub);
    const reporter = recordingReporter();

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test", reportFailure: reporter.report });

    // The user-facing envelope is unchanged — this phase adds observation only.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(bucket);

    expect(reporter.calls).toHaveLength(1);
    expect(reporter.calls[0].location).toBe(location);
  });

  it("attaches the provider status on the non-ok path, so 429 and 5xx stay distinguishable", async () => {
    stubFetch(() => new Response("slow down", { status: 429 }));
    const reporter = recordingReporter();

    await generateCvDraft(buildAnswers(), { apiKey: "sk-test", reportFailure: reporter.report });

    expect(reporter.calls[0].props?.status).toBe(429);
  });

  it("works with no reporter supplied — the service stays usable standalone", async () => {
    stubFetch(() => new Response("upstream error", { status: 500 }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    expect(result.ok).toBe(false);
  });

  it("reports nothing on a successful generation", async () => {
    stubFetch(() => okResponse({ content: JSON.stringify(buildModelContent()) }));
    const reporter = recordingReporter();

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test", reportFailure: reporter.report });

    expect(result.ok).toBe(true);
    expect(reporter.calls).toHaveLength(0);
  });

  it("reports nothing when the API key is absent — that is config, not a runtime failure", async () => {
    const reporter = recordingReporter();

    await generateCvDraft(buildAnswers(), { apiKey: "", reportFailure: reporter.report });

    expect(reporter.calls).toHaveLength(0);
  });

  /**
   * The load-bearing privacy check for this surface. The refusal text and the zod issue list are
   * both derived from the user's answers; neither may reach the reporter.
   */
  it("never passes answers, draft content, or refusal text to the reporter", async () => {
    const cases = [
      () => okResponse({ refusal: `Cannot help with ${SECRET_EXPERIENCE}`, content: null }),
      () => okResponse({ content: `{"broken": "${SECRET_NAME}"` }),
      () =>
        okResponse({
          content: JSON.stringify({
            sections: { summary: { body: "" }, experience: [], education: [], skills: [], languages: [] },
            assumptions: [{ field: SECRET_NAME, reason: SECRET_EXPERIENCE }],
            warnings: [],
          }),
        }),
    ];

    for (const stub of cases) {
      stubFetch(stub);
      const reporter = recordingReporter();

      await generateCvDraft(buildAnswers(), { apiKey: "sk-test", reportFailure: reporter.report });

      const serialized = JSON.stringify(
        reporter.calls.map((call) => ({
          location: call.location,
          props: call.props,
          error: call.error instanceof Error ? { name: call.error.name, message: call.error.message } : call.error,
        })),
      );
      expect(serialized).not.toContain(SECRET_NAME);
      expect(serialized).not.toContain(SECRET_EXPERIENCE);
    }
  });
});

describe("generateCvDraft — prompt assembly", () => {
  it("sends a system + user message carrying the output language and field labels", async () => {
    const recorder = recordingStub();

    await generateCvDraft(buildAnswers("ru"), { apiKey: "sk-test" });

    expect(recorder.getUrl()).toContain("openai.com");
    const body = recorder.getRequest();
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[1]?.role).toBe("user");
    const userPrompt = body.messages[1]?.content ?? "";
    expect(userPrompt).toContain("Russian");
    expect(userPrompt).toContain("Full name");
    expect(userPrompt).toContain("Target role or goal");
    // Strict structured-output contract is requested.
    expect(body.response_format?.type).toBe("json_schema");
  });
});

describe("generateCvDraft — privacy", () => {
  it("never echoes raw answer values into a failure envelope", async () => {
    stubFetch(() => new Response("upstream error", { status: 500 }));

    const result = await generateCvDraft(buildAnswers(), { apiKey: "sk-test" });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET_NAME);
    expect(serialized).not.toContain(SECRET_EXPERIENCE);
  });
});
