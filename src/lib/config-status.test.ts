import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
  POSTHOG_API_KEY: undefined,
  SUPABASE_KEY: "supabase-key",
  SUPABASE_URL: "https://example.supabase.co",
}));

describe("configStatuses", () => {
  it("surfaces missing PostHog configuration", async () => {
    const { configStatuses, missingConfigs } = await import("./config-status");

    expect(configStatuses).toContainEqual(
      expect.objectContaining({
        name: "PostHog",
        configured: false,
      }),
    );
    expect(missingConfigs.map((config) => config.name)).toContain("PostHog");
  });
});
