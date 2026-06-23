import { describe, expect, it } from "vitest";

import { scrub } from "./scrub";

describe("scrub", () => {
  it("keeps only allowlisted primitive properties", () => {
    const result = scrub({
      surface: "server",
      route: "/api/cv/generate",
      status: 503,
      duration_ms: 123,
      success: false,
      method: "google",
      answers: "raw answer text",
      prompt: "raw prompt",
      draft: "raw draft",
      content: "raw cv content",
      unknown: "not allowed",
    });

    expect(result).toEqual({
      surface: "server",
      route: "/api/cv/generate",
      status: 503,
      duration_ms: 123,
      success: false,
      method: "google",
    });
  });

  it("drops nested values and oversized strings", () => {
    const result = scrub({
      surface: "client",
      locale: "pl",
      error_type: "Error",
      error_location: "x".repeat(121),
      model_provider: { name: "openai" },
      duration_ms: [100],
    });

    expect(result).toEqual({
      surface: "client",
      locale: "pl",
      error_type: "Error",
    });
  });
});
