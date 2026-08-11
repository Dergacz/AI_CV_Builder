import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";
import type { EntitlementStatus } from "@/types";

/**
 * Entitlement contract & store (F-01).
 *
 * The single server-authoritative answer to "is this user Advanced right now?".
 * The read delegates the time comparison to Postgres via the `get_entitlement()`
 * function (DB clock is the only clock, scoped to `auth.uid()`), so the gate cannot
 * be skewed or bypassed client-side (FR-003). Absence of a subscription row ⇒ Basic.
 *
 * Writes go through `upsertEntitlement`, which requires a privileged (service-role)
 * client — user RLS denies all writes to this table. No HTTP envelope here; like the
 * CV repository these functions throw on DB error and let callers map failures.
 */

type TypedSupabaseClient = SupabaseClient<Database>;

const BASIC: EntitlementStatus = { tier: "basic", isAdvanced: false, activeUntil: null };

/**
 * Resolve the current user's entitlement. `userId` must be the verified
 * `auth.getUser()` id; the read's authority is `auth.uid()` inside the SQL function,
 * but callers pass the id so the precondition (an authenticated user) is explicit.
 * Returns Basic when the user has no subscription or the paid period has elapsed.
 */
export async function resolveEntitlement(supabase: TypedSupabaseClient, userId: string): Promise<EntitlementStatus> {
  if (!userId) {
    throw new Error("resolveEntitlement requires a verified user id");
  }
  const { data, error } = await supabase.rpc("get_entitlement");
  if (error) {
    throw error;
  }
  // Zero rows ⇒ no subscription ⇒ Basic. A present row with is_advanced false means
  // the paid period has elapsed (expired or canceled-and-elapsed) ⇒ also Basic.
  if (data.length === 0) {
    return BASIC;
  }
  const row = data[0];
  if (!row.is_advanced) {
    return BASIC;
  }
  return { tier: "advanced", isAdvanced: true, activeUntil: row.current_period_end };
}

/** Status values mirrored from the `subscriptions.status` check constraint. */
export type SubscriptionStatus = "active" | "canceled" | "expired";

export interface EntitlementUpsertInput {
  status: SubscriptionStatus;
  /** ISO timestamp; "Advanced right now" holds while this is in the future. */
  currentPeriodEnd: string;
}

/**
 * Upsert (by `user_id`) a subscriber's entitlement row. The `client` MUST be
 * privileged (service-role / RLS-bypassing) — user-scoped clients are denied writes
 * by RLS. Not wired to any user-facing route in this slice; S-02's verified-payment
 * webhook is its first real caller, and tests use it to seed rows. Throws on error.
 */
export async function upsertEntitlement(
  client: TypedSupabaseClient,
  userId: string,
  input: EntitlementUpsertInput,
): Promise<void> {
  const row: Database["public"]["Tables"]["subscriptions"]["Insert"] = {
    user_id: userId,
    status: input.status,
    current_period_end: input.currentPeriodEnd,
  };
  const { error } = await client.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) {
    throw error;
  }
}
