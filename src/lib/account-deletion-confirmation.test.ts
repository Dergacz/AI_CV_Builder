import { describe, expect, it } from "vitest";

import { confirmationMatches } from "@/lib/account-deletion-confirmation";

/**
 * S-08: the confirmation gate. Shared verbatim by the island and the route, so these cases pin the
 * behaviour of BOTH sides at once — a divergence here would let a user confirm an irreversible
 * erasure in the browser only to be refused by the server.
 */
describe("confirmationMatches", () => {
  it("accepts the exact account email", () => {
    expect(confirmationMatches("ada@example.com", "ada@example.com")).toBe(true);
  });

  it("ignores case — the value is the deliberateness, not keystroke fidelity", () => {
    expect(confirmationMatches("Ada@Example.COM", "ada@example.com")).toBe(true);
    expect(confirmationMatches("ada@example.com", "ADA@EXAMPLE.COM")).toBe(true);
  });

  it("ignores surrounding whitespace on both sides", () => {
    expect(confirmationMatches("  ada@example.com \n", "ada@example.com")).toBe(true);
    expect(confirmationMatches("ada@example.com", "  ada@example.com  ")).toBe(true);
  });

  it("rejects a different address", () => {
    expect(confirmationMatches("eve@example.com", "ada@example.com")).toBe(false);
  });

  it("rejects a near-miss", () => {
    expect(confirmationMatches("ada@example.co", "ada@example.com")).toBe(false);
    expect(confirmationMatches("ada@exampl.com", "ada@example.com")).toBe(false);
  });

  it("rejects internal whitespace — only the surrounding kind is forgiven", () => {
    expect(confirmationMatches("ada @example.com", "ada@example.com")).toBe(false);
  });

  it("rejects an empty confirmation", () => {
    expect(confirmationMatches("", "ada@example.com")).toBe(false);
    expect(confirmationMatches("   ", "ada@example.com")).toBe(false);
  });

  it("fails closed when the account has no email", () => {
    // A session without an email must never be able to satisfy the gate — including when the user
    // types the empty string, which would otherwise "match" a blank expectation.
    expect(confirmationMatches("", null)).toBe(false);
    expect(confirmationMatches("", undefined)).toBe(false);
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches("   ", "   ")).toBe(false);
    expect(confirmationMatches("anything", null)).toBe(false);
  });
});
