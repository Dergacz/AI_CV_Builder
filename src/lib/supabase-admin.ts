import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SECRET_KEY } from "astro:env/server";

/**
 * S-08: the ONLY module in this codebase that reads `SUPABASE_SECRET_KEY`.
 *
 * That key is the Supabase secret (service-role) key: it bypasses every RLS policy in the
 * project, so a bug in any route holding it is potentially a whole-database bug. Two things keep
 * the blast radius bounded, and both are load-bearing:
 *
 *   1. **No admin client is exported.** This module exposes one operation — delete a user by id —
 *      rather than a client someone could reach for later. There is deliberately no
 *      `getAdminClient()`.
 *   2. **An ESLint fence** (`no-restricted-imports` in `eslint.config.js`) makes importing this
 *      module from anywhere except `src/lib/services/account-deletion.ts` a lint error, so the
 *      reach of the key cannot quietly widen. `account-deletion.ts` re-exports what callers need.
 *
 * The client is built per call rather than at module scope: the Workers runtime reuses an isolate
 * across requests, and a long-lived privileged client is exactly the thing not to keep warm.
 */

export type AdminDeleteResult = { ok: true } | { ok: false; error: unknown };

/**
 * Whether the privileged path is usable. Both the API route and the `/account` page consult this:
 * without it the page would render a delete button that can only ever 503. Absence is a valid
 * deployment state (local dev, and any environment where the secret was not set), so this is a
 * predicate rather than a throw.
 */
export function isAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL?.trim() && SUPABASE_SECRET_KEY?.trim());
}

/**
 * Permanently delete an `auth.users` row. Every user-scoped table declares
 * `user_id ... references auth.users (id) on delete cascade`, so this single call also removes the
 * user's CVs, questionnaire snapshots, feedback, subscription row, and generation-ledger rows —
 * see the header comment in `supabase/migrations/20260731124357_create_generation_usage.sql`.
 *
 * `userId` must come from a server-verified session. This function cannot check that, which is
 * precisely why its only caller is the account-deletion service and why the fence exists.
 *
 * Returns a result instead of throwing: the caller has to distinguish "the erasure failed" from
 * every other failure mode, and an exception crossing this boundary would lose that distinction.
 */
export async function deleteUserAccount(userId: string): Promise<AdminDeleteResult> {
  // Read into locals rather than calling isAdminConfigured(): a predicate cannot narrow
  // `string | undefined` across a function boundary, and these must be non-empty strings here.
  const url = SUPABASE_URL?.trim();
  const secretKey = SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) {
    return { ok: false, error: new Error("Supabase admin client is not configured") };
  }

  try {
    // Not `@supabase/ssr`: this client must carry no cookies and no session. `persistSession` and
    // `autoRefreshToken` are off because the Workers runtime has no storage for either, and a
    // privileged client has no business holding a session anyway.
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return { ok: false, error };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
