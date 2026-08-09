import type { APIRoute } from "astro";
import { z } from "zod";
import { ACCOUNT_DELETED_REDIRECT, accountDeleteErrorMessages } from "@/lib/account-delete-messages";
import { scheduleErrorReport } from "@/lib/observability/schedule";
import { readBoundedJson } from "@/lib/request-body";
import { adminAccountDeps, deleteAccount, type DeleteAccountStage } from "@/lib/services/account-deletion";
import { createClient, safeGetUser } from "@/lib/supabase";
import type { DeleteAccountResponse } from "@/types";

export const prerender = false;

/** A confirmation string and nothing else. Small because it only ever holds one email address. */
const MAX_REQUEST_BODY_BYTES = 2_000;

/**
 * S-08: the request body carries the typed confirmation ONLY.
 *
 * There is deliberately no user-id field. The account being deleted is always the one on the
 * verified session, so an id in the body would be either ignored or — far worse — trusted. That
 * absence is the difference between a deletion endpoint and an account-deletion vulnerability,
 * and it is pinned by a test.
 */
const deleteAccountSchema = z.object({
  confirmation: z.string().max(320),
});

function json(status: number, body: DeleteAccountResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fail(status: number, error: keyof typeof accountDeleteErrorMessages): Response {
  return json(status, { ok: false, error, message: accountDeleteErrorMessages[error] });
}

/**
 * POST /api/account/delete — permanently delete the signed-in user's account (FR-011 / US-03).
 *
 * Immediate and irreversible: the admin `deleteUser` call removes the `auth.users` row, and the
 * `on delete cascade` foreign keys on every user-scoped table remove the CVs, questionnaire
 * snapshots, feedback, subscription row, and generation-ledger rows in the same transaction.
 *
 * Returns JSON rather than redirecting, because the caller is a `fetch` from the confirmation
 * island and a 3xx would not navigate it.
 */
export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return fail(401, "session_expired");
  }

  const body = await readBoundedJson(context.request, MAX_REQUEST_BODY_BYTES);
  if (!body.ok) {
    return fail(400, "confirmation_mismatch");
  }

  const parsed = deleteAccountSchema.safeParse(body.body);
  if (!parsed.success) {
    return fail(400, "confirmation_mismatch");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return fail(503, "service_unavailable");
  }

  // Re-verify against the auth server rather than trusting `locals.user`: this is the identity the
  // deletion runs against, and it is the ONLY source of the user id and the comparison email.
  const user = await safeGetUser(supabase, context.locals);
  if (!user) {
    return fail(401, "session_expired");
  }

  const reportFailure = (error: unknown, stage: DeleteAccountStage) => {
    scheduleErrorReport(
      error,
      { error_location: stage === "delete" ? "api/account/delete:delete" : "api/account/delete:teardown" },
      context.locals,
    );
  };

  const result = await deleteAccount({
    ...adminAccountDeps,
    userId: user.id,
    accountEmail: user.email,
    confirmation: parsed.data.confirmation,
    reportFailure,
    // Post-commit teardown. Ends the Supabase session and drops the two cookies that tie this
    // browser to the deleted identity: `obs_session` (the analytics session id) and `obs_confirmed`
    // (the email-confirmed funnel marker). `ui_locale` deliberately survives — it is a device
    // preference, not personal data, and clearing it would flip the UI to English at the exact
    // moment the user reads the confirmation. Any throw here is reported and swallowed by
    // `deleteAccount`: the account is already gone.
    teardown: async () => {
      await supabase.auth.signOut();
      context.cookies.delete("obs_session", { path: "/" });
      context.cookies.delete("obs_confirmed", { path: "/" });
    },
  });

  if (result.ok) {
    return json(200, { ok: true, redirectTo: ACCOUNT_DELETED_REDIRECT });
  }

  switch (result.reason) {
    case "mismatch":
      return fail(400, "confirmation_mismatch");
    case "not_configured":
      return fail(503, "service_unavailable");
    case "delete_failed":
      return fail(500, "delete_failed");
  }
};
