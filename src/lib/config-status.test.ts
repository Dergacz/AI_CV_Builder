import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
  OBSERVABILITY_ID_SALT: undefined,
  POSTHOG_API_KEY: "phc_server_key",
  SUPABASE_KEY: "supabase-key",
  SUPABASE_URL: "https://example.supabase.co",
}));

vi.mock("astro:env/client", () => ({
  PUBLIC_POSTHOG_KEY: "phc_public_key",
}));

describe("configStatuses", () => {
  it("treats PostHog as unconfigured when any of the three keys is missing", async () => {
    // Server + public keys are set, but the pseudonymous-ID salt is not — partial config
    // must still surface the banner so the silent identity degradation is visible.
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
