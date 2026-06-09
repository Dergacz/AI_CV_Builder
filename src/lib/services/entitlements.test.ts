import { describe, expect, it, vi } from "vitest";

import { resolveEntitlement } from "@/lib/services/entitlements";
import type { EntitlementStatus } from "@/types";

/**
 * Hermetic contract tests for the entitlement resolver (F-01).
 *
 * Oracle: the PRD/roadmap rule — a user is Advanced iff their paid period has not
 * elapsed, Basic otherwise; `activeUntil` is set only while Advanced. The DB clock
 * decides `is_advanced` (proven by Phase 1's integration check against the real
 * `now()` boundary); these tests pin the resolver's MAPPING of that signal to the
 * `EntitlementStatus` DTO, plus the no-row default and error/precondition behavior.
 * The `rpc` call is stubbed so no DB is required.
 */

type Client = Parameters<typeof resolveEntitlement>[0];

function clientReturning(data: unknown, error: unknown = null): Client {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) } as unknown as Client;
}

const FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

describe("resolveEntitlement", () => {
  const cases: { name: string; data: unknown; expected: EntitlementStatus }[] = [
    {
      name: "no subscription row ⇒ Basic",
      data: [],
      expected: { tier: "basic", isAdvanced: false, activeUntil: null },
    },
    {
      name: "active, period not yet elapsed ⇒ Advanced with activeUntil",
      data: [{ is_advanced: true, current_period_end: FUTURE }],
      expected: { tier: "advanced", isAdvanced: true, activeUntil: FUTURE },
    },
    {
      name: "period elapsed (expired or canceled-and-elapsed) ⇒ Basic, no activeUntil",
      data: [{ is_advanced: false, current_period_end: PAST }],
      expected: { tier: "basic", isAdvanced: false, activeUntil: null },
    },
  ];

  it.each(cases)("maps $name", async ({ data, expected }) => {
    const result = await resolveEntitlement(clientReturning(data), "user-123");
    expect(result).toEqual(expected);
  });

  it("throws when the rpc returns a DB error", async () => {
    const client = clientReturning(null, { message: "boom" });
    await expect(resolveEntitlement(client, "user-123")).rejects.toBeTruthy();
  });

  it("throws and never queries when no verified user id is supplied", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { rpc } as unknown as Client;
    await expect(resolveEntitlement(client, "")).rejects.toThrow(/verified user id/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
