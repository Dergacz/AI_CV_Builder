import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hermetic contract tests for the generation quota service (S-06 / FR-012).
 *
 * Oracle: the FR-012 rule — a user gets 100 generations per UTC day, the product gets 500
 * per rolling hour, and neither limit may be decided anywhere but Postgres. These tests pin
 * the service's MAPPING of the SQL verdict onto `QuotaVerdict`, the limit resolution from
 * env, and the failure posture (throw, so the route can choose fail-open). The DB-side
 * behaviour — the UTC day boundary, RLS denial, and the self-bounding insert — is proven by
 * the phase's SQL-level verification, not here; the `rpc` call is stubbed so no DB is needed.
 */

const mocks = vi.hoisted(() => ({
  dailyLimit: undefined as number | undefined,
  hourlyCeiling: undefined as number | undefined,
}));

vi.mock("astro:env/server", () => ({
  get GENERATION_DAILY_LIMIT() {
    return mocks.dailyLimit;
  },
  get GENERATION_HOURLY_CEILING() {
    return mocks.hourlyCeiling;
  },
}));

import {
  DEFAULT_DAILY_LIMIT,
  DEFAULT_HOURLY_CEILING,
  checkGenerationQuota,
  getGenerationLimits,
  recordGeneration,
  type GenerationLimits,
  type QuotaVerdict,
} from "@/lib/services/generation-quota";

type Client = Parameters<typeof checkGenerationQuota>[0];

const LIMITS: GenerationLimits = { dailyLimit: 100, hourlyCeiling: 500 };

/** Returns the stub client alongside its `rpc` spy, so assertions never unbind the method. */
function clientWithRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as unknown as Client, rpc };
}

function clientReturning(data: unknown, error: unknown = null): Client {
  return clientWithRpc(data, error).client;
}

beforeEach(() => {
  mocks.dailyLimit = undefined;
  mocks.hourlyCeiling = undefined;
});

describe("checkGenerationQuota", () => {
  const cases: { name: string; data: unknown; expected: QuotaVerdict }[] = [
    { name: "under both limits ⇒ ok", data: "ok", expected: "ok" },
    { name: "at the per-user daily cap ⇒ user_daily", data: "user_daily", expected: "user_daily" },
    { name: "at the product-wide hourly ceiling ⇒ global_hourly", data: "global_hourly", expected: "global_hourly" },
    // A verdict this build does not recognise must never become a wall in front of a real user.
    { name: "unrecognized verdict degrades to ok", data: "some_future_verdict", expected: "ok" },
    { name: "null verdict degrades to ok", data: null, expected: "ok" },
  ];

  it.each(cases)("$name", async ({ data, expected }) => {
    await expect(checkGenerationQuota(clientReturning(data), LIMITS)).resolves.toBe(expected);
  });

  it("passes both limits to the SQL function", async () => {
    const { client, rpc } = clientWithRpc("ok");
    await checkGenerationQuota(client, { dailyLimit: 7, hourlyCeiling: 11 });

    expect(rpc).toHaveBeenCalledWith("check_generation_quota", {
      p_daily_limit: 7,
      p_hourly_ceiling: 11,
    });
  });

  it("throws on a DB error so the caller owns the failure posture", async () => {
    const client = clientReturning(null, { message: "connection refused" });
    await expect(checkGenerationQuota(client, LIMITS)).rejects.toBeTruthy();
  });
});

describe("recordGeneration", () => {
  it("returns true when a row was written", async () => {
    await expect(recordGeneration(clientReturning(true), LIMITS)).resolves.toBe(true);
  });

  it("returns false when the daily cap refused the insert", async () => {
    await expect(recordGeneration(clientReturning(false), LIMITS)).resolves.toBe(false);
  });

  it("passes only the daily limit to the SQL function", async () => {
    const { client, rpc } = clientWithRpc(true);
    await recordGeneration(client, { dailyLimit: 7, hourlyCeiling: 11 });

    expect(rpc).toHaveBeenCalledWith("record_generation", { p_daily_limit: 7 });
  });

  it("throws on a DB error", async () => {
    const client = clientReturning(null, { message: "connection refused" });
    await expect(recordGeneration(client, LIMITS)).rejects.toBeTruthy();
  });
});

describe("getGenerationLimits", () => {
  it("falls back to the FR-012 defaults when the env vars are unset", () => {
    expect(getGenerationLimits()).toEqual({
      dailyLimit: DEFAULT_DAILY_LIMIT,
      hourlyCeiling: DEFAULT_HOURLY_CEILING,
    });
    expect(DEFAULT_DAILY_LIMIT).toBe(100);
    expect(DEFAULT_HOURLY_CEILING).toBe(500);
  });

  it("uses configured overrides when present", () => {
    mocks.dailyLimit = 3;
    mocks.hourlyCeiling = 9;

    expect(getGenerationLimits()).toEqual({ dailyLimit: 3, hourlyCeiling: 9 });
  });

  it("honours 0 as a real limit — it is the E2E lever, not a missing value", () => {
    mocks.dailyLimit = 0;

    expect(getGenerationLimits().dailyLimit).toBe(0);
  });

  it.each([
    { name: "negative", value: -1 },
    { name: "fractional", value: 1.5 },
    { name: "NaN", value: Number.NaN },
  ])("ignores an unusable $name value and uses the default", ({ value }) => {
    mocks.dailyLimit = value;

    expect(getGenerationLimits().dailyLimit).toBe(DEFAULT_DAILY_LIMIT);
  });
});
