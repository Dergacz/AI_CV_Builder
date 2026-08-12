import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R-17: the Google sign-in surface must disappear when the provider is not configured, rather than
 * offering a button that hands the user to Supabase's `/authorize` for an "Unsupported provider"
 * rejection outside the app.
 *
 * This file pins the predicate that decision rests on. The boundary cases are not academic: the
 * whitespace case is exactly what licenses `.env.example` shipping the variable blank rather than
 * special-casing a `###` sentinel in shipping code, and the unset case is the default local state
 * for any developer without Google credentials.
 */

const mockEnv = vi.hoisted(() => ({ clientId: undefined as string | undefined }));

vi.mock("astro:env/server", () => ({
  // A getter, not a fixed value: the predicate reads the binding per call, so each case can set
  // `mockEnv.clientId` without re-importing the module under test.
  get SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID() {
    return mockEnv.clientId;
  },
}));

import { isGoogleAuthConfigured } from "@/lib/auth/google-provider";

beforeEach(() => {
  mockEnv.clientId = undefined;
});

describe("isGoogleAuthConfigured", () => {
  it("is false when the client id is unset", () => {
    expect(isGoogleAuthConfigured()).toBe(false);
  });

  it("is false when the client id is empty", () => {
    mockEnv.clientId = "";

    expect(isGoogleAuthConfigured()).toBe(false);
  });

  it.each(["   ", "\t", "\n", " \t\n "])("is false when the client id is whitespace only (%j)", (value) => {
    mockEnv.clientId = value;

    expect(isGoogleAuthConfigured()).toBe(false);
  });

  it("is true when a client id is present", () => {
    mockEnv.clientId = "1234567890-abc.apps.googleusercontent.com";

    expect(isGoogleAuthConfigured()).toBe(true);
  });

  it("is true for a padded client id — the value is trimmed, not rejected", () => {
    mockEnv.clientId = "  1234567890-abc.apps.googleusercontent.com  ";

    expect(isGoogleAuthConfigured()).toBe(true);
  });
});
