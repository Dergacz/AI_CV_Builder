/**
 * S-08: user-facing account-deletion error copy. Zod-free and server-free on purpose, so the
 * client island can import the values without pulling Supabase into the browser bundle — mirrors
 * `cv-save-messages.ts`.
 *
 * Following the S-09 pattern: the server returns the English `message` for response
 * compatibility plus a stable `error` bucket, and the client localizes by mapping that bucket.
 * Messages never leak provider, internal, or SQL detail.
 */

/** Stable failure buckets for the account-deletion endpoint. */
export type AccountDeleteErrorBucket =
  | "confirmation_mismatch"
  | "session_expired"
  | "service_unavailable"
  | "delete_failed";

/** English copy for each bucket. Server-facing: used for the response `message` field. */
export const accountDeleteErrorMessages: Record<AccountDeleteErrorBucket, string> = {
  confirmation_mismatch: "That doesn't match your account email. Nothing has been deleted.",
  session_expired: "Your session has expired. Please sign in again.",
  service_unavailable: "Account deletion is temporarily unavailable. Please try again later.",
  delete_failed: "We couldn't delete your account. Nothing has been deleted — please try again.",
};

/** Where the client sends the user after a successful deletion. Public, session-free by design. */
export const ACCOUNT_DELETED_REDIRECT = "/?deleted=1";
