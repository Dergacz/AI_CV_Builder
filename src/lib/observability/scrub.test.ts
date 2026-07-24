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

  it("passes generation_event_id (uuid string) and helpful (boolean) through the allowlist", () => {
    const result = scrub({
      generation_event_id: "550e8400-e29b-41d4-a716-446655440000",
      helpful: true,
    });

    expect(result).toEqual({
      generation_event_id: "550e8400-e29b-41d4-a716-446655440000",
      helpful: true,
    });
  });

  it("still drops keys not on the allowlist", () => {
    const result = scrub({
      generation_event_id: "550e8400-e29b-41d4-a716-446655440000",
      comment: "raw user comment text",
      draft: "raw cv content",
    });

    expect(result).toEqual({ generation_event_id: "550e8400-e29b-41d4-a716-446655440000" });
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
