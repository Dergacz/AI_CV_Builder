import type { GenerateDraftResponse } from "@/lib/cv-draft";

/**
 * Deterministic CV draft used to mock the generation boundary in E2E.
 *
 * Why mock here: generation runs SERVER-SIDE (src/lib/services/cv-generation.ts
 * calls OpenAI from the API route), so the browser never calls OpenAI directly and
 * `page.route('https://api.openai.com/...')` cannot intercept it. The nearest
 * interceptable seam for a browser-driven test is the app's own `/api/cv/generate`
 * endpoint. We mock ONLY the nondeterministic LLM result; the save path that R1
 * actually protects (POST /api/cv → Supabase → dashboard SSR) stays real.
 *
 * Shape matches GeneratedCvDraft (src/lib/cv-draft.ts) so it passes both the client
 * editor and the server-side cvSaveSchema on save.
 */
export function buildGeneratedDraftResponse(): GenerateDraftResponse {
  return {
    ok: true,
    draft: {
      schemaVersion: 1,
      language: "en",
      source: {
        questionnaireVersion: "e2e",
        generatedAt: "2026-01-01T00:00:00.000Z",
        modelProvider: "mock",
        modelName: "e2e-mock",
      },
      sections: {
        summary: {
          headline: "Customer Support Specialist",
          body: "Reliable, people-first support professional who turns everyday questions into calm resolutions.",
        },
        experience: [
          {
            role: "Customer Support Volunteer",
            organization: "Community Help Desk",
            description: "Answered questions over chat and email and kept people informed.",
            highlights: ["Resolved everyday requests end to end", "Kept a friendly, clear tone"],
          },
        ],
        education: [{ institution: "Community College", program: "General studies" }],
        skills: [{ label: "Core strengths", items: ["Customer communication", "Teamwork", "Organization"] }],
        languages: [{ name: "English", proficiency: "B2" }],
      },
      assumptions: [],
      warnings: [],
    },
  };
}
