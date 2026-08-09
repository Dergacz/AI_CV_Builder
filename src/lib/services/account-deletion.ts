import { confirmationMatches } from "@/lib/account-deletion-confirmation";
import { deleteUserAccount, isAdminConfigured, type AdminDeleteResult } from "@/lib/supabase-admin";

/**
 * S-08 account deletion (FR-011 / US-03).
 *
 * Holds the deletion sequence and — more importantly — its ordering guarantee, in one place that
 * can be unit-tested without a live Supabase. Every dependency is injected rather than imported at
 * the call site, the same way `cv-generation.ts` takes its reporter, so the whole sequence
 * including the failure paths is exercisable with fakes.
 *
 * **The ordering is the point.** `deleteUser` is the commit point. Everything before it may abort
 * the request with an error; everything after it is best-effort and must never surface as a
 * failure, because the data is already gone and an error screen would tell the user the opposite
 * of the truth. Teardown failures are reported (a broken teardown is our defect) and swallowed.
 *
 * This module is also the single public entry point for the privileged path: it re-exports what
 * routes and pages need, so `supabase-admin.ts` stays behind the ESLint fence and no other module
 * can reach the service-role key.
 */

export { isAdminConfigured };
export { confirmationMatches };

/** Why a deletion did not happen. Maps 1:1 onto the route's status codes. */
export type DeleteAccountFailure = "mismatch" | "not_configured" | "delete_failed";

export type DeleteAccountResult = { ok: true } | { ok: false; reason: DeleteAccountFailure };

/** Which step failed, so the report lands in the right bucket. */
export type DeleteAccountStage = "delete" | "teardown";

export interface DeleteAccountDeps {
  /** From the server-verified session ONLY — never from request input. */
  userId: string;
  /** The session user's own email; the confirmation is compared against this. */
  accountEmail: string | null | undefined;
  /** What the user typed into the confirmation field. */
  confirmation: string;
  isConfigured: () => boolean;
  deleteUser: (userId: string) => Promise<AdminDeleteResult>;
  /** Post-commit client-state teardown (sign-out + observability cookies). May reject. */
  teardown: () => Promise<void>;
  reportFailure: (error: unknown, stage: DeleteAccountStage) => void;
}

/** Real implementations, spread into the deps at the call site. Tests pass fakes instead. */
export const adminAccountDeps = {
  isConfigured: isAdminConfigured,
  deleteUser: deleteUserAccount,
} satisfies Pick<DeleteAccountDeps, "isConfigured" | "deleteUser">;

export async function deleteAccount(deps: DeleteAccountDeps): Promise<DeleteAccountResult> {
  // Configuration first: without the privileged path there is nothing to attempt, and answering
  // "unavailable" is more honest than letting a mismatched confirmation mask a misconfiguration.
  if (!deps.isConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  if (!confirmationMatches(deps.confirmation, deps.accountEmail)) {
    return { ok: false, reason: "mismatch" };
  }

  const deleted = await deps.deleteUser(deps.userId);
  if (!deleted.ok) {
    // The erasure path itself is broken — our defect, and one the user cannot report usefully.
    deps.reportFailure(deleted.error, "delete");
    return { ok: false, reason: "delete_failed" };
  }

  // ---- commit point passed: the account is gone. Nothing below may fail the request. ----
  try {
    await deps.teardown();
  } catch (error) {
    deps.reportFailure(error, "teardown");
  }

  return { ok: true };
}
