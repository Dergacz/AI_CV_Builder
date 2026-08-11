import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("./index", () => ({ track: mocks.track }));

import { trackEmailConfirmedOnce } from "./funnel";

const identity = { distinctId: "pseudo-id" };

function makeCookies(existing?: string) {
  return {
    get: vi.fn().mockReturnValue(existing ? { value: existing } : undefined),
    set: vi.fn(),
  };
}

beforeEach(() => {
  mocks.track.mockReset();
});

describe("trackEmailConfirmedOnce", () => {
  it("emits once and sets the marker when confirmed and unmarked", async () => {
    const cookies = makeCookies();

    const emitted = await trackEmailConfirmedOnce(
      { email_confirmed_at: "2026-01-01T00:00:00Z" },
      cookies,
      identity,
      "en",
    );

    expect(emitted).toBe(true);
    expect(mocks.track).toHaveBeenCalledWith("funnel_email_confirmed", { locale: "en" }, identity);
    expect(cookies.set).toHaveBeenCalledWith(
      "obs_confirmed",
      "1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", secure: true }),
    );
  });

  it("does not re-emit when the marker cookie is already present", async () => {
    const cookies = makeCookies("1");

    const emitted = await trackEmailConfirmedOnce(
      { email_confirmed_at: "2026-01-01T00:00:00Z" },
      cookies,
      identity,
      "en",
    );

    expect(emitted).toBe(false);
    expect(mocks.track).not.toHaveBeenCalled();
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it("does not emit when the email is not yet confirmed", async () => {
    const cookies = makeCookies();

    expect(await trackEmailConfirmedOnce({ email_confirmed_at: null }, cookies, identity, "en")).toBe(false);
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("does not emit for an anonymous request", async () => {
    const cookies = makeCookies();

    expect(await trackEmailConfirmedOnce(null, cookies, identity, "en")).toBe(false);
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
