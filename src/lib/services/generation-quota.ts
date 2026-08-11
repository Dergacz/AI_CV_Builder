import { GENERATION_DAILY_LIMIT, GENERATION_HOURLY_CEILING } from "astro:env/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

/**
 * Generation quota service (S-06 / FR-012).
 *
 * The server-authoritative answer to "may this user generate right now?". Both the
 * per-user daily cap and the product-wide hourly ceiling are decided inside Postgres
 * (`check_generation_quota`), so the DB clock is the only clock and the gate cannot be
 * skewed or bypassed from the user's device. Successful generations are recorded via
 * `record_generation`, which re-checks the daily cap itself so the ledger stays bounded.
 *
 * No HTTP envelope here: like `entitlements.ts` and the CV repository, these functions
 * throw on DB error and let the caller choose the failure posture. The generation route
 * deliberately fails OPEN — this is abuse protection, not a paywall, and a counter
 * outage must never take down the product's core feature.
 */

type TypedSupabaseClient = SupabaseClient<Database>;

/** Why a generation was refused, or `ok` to proceed. Mirrors the SQL function's return values. */
export type QuotaVerdict = "ok" | "user_daily" | "global_hourly";

export interface GenerationLimits {
  /** Successful generations allowed per user per UTC day. */
  dailyLimit: number;
  /** Successful generations allowed product-wide per rolling hour. */
  hourlyCeiling: number;
}

export const DEFAULT_DAILY_LIMIT = 100;
/**
 * ~5 users each exhausting a full day's allowance inside one hour — far above realistic
 * organic volume, so it can only trip on genuine cross-account abuse. Unvalidated against
 * real traffic; the `generation_limit_reached` event exists so it can be revisited.
 */
export const DEFAULT_HOURLY_CEILING = 500;

/**
 * Resolve the configured limits, falling back to the defaults when the env vars are unset
 * or unusable. Kept separate from the functions below so callers can inject explicit limits
 * (tests, and the E2E server that runs with the daily limit pinned to 0).
 */
export function getGenerationLimits(): GenerationLimits {
  return {
    dailyLimit: positiveIntOr(GENERATION_DAILY_LIMIT, DEFAULT_DAILY_LIMIT),
    hourlyCeiling: positiveIntOr(GENERATION_HOURLY_CEILING, DEFAULT_HOURLY_CEILING),
  };
}

/**
 * A limit of 0 is meaningful (refuse everything — the E2E lever), so only reject values that
 * cannot express a limit at all: non-finite, negative, or fractional.
 */
function positiveIntOr(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return fallback;
  }
  return value;
}

/**
 * Ask Postgres whether the current user may generate. Throws on DB error — the caller
 * decides what a fault means (the generation route treats it as "allow").
 *
 * An unrecognized verdict degrades to `ok`: a value this build does not know about must
 * never become a wall in front of a legitimate user.
 */
export async function checkGenerationQuota(
  supabase: TypedSupabaseClient,
  limits: GenerationLimits,
): Promise<QuotaVerdict> {
  const { data, error } = await supabase.rpc("check_generation_quota", {
    p_daily_limit: limits.dailyLimit,
    p_hourly_ceiling: limits.hourlyCeiling,
  });
  if (error) {
    throw error;
  }
  return data === "user_daily" || data === "global_hourly" ? data : "ok";
}

/**
 * Record one successful generation. Returns whether a row was actually written — the SQL
 * function refuses the insert if the caller is already at their daily cap, which is what
 * keeps the ledger bounded under concurrency. Callers treat `false` as informational: the
 * draft is already built by this point and is returned either way.
 */
export async function recordGeneration(supabase: TypedSupabaseClient, limits: GenerationLimits): Promise<boolean> {
  const { data, error } = await supabase.rpc("record_generation", {
    p_daily_limit: limits.dailyLimit,
  });
  if (error) {
    throw error;
  }
  return data;
}
