import { useId, useState } from "react";

import ConfirmDialog from "@/components/cv/ConfirmDialog";
import { confirmationMatches } from "@/lib/account-deletion-confirmation";
import { getMessages } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";
import { reportErrorClient } from "@/lib/observability/client.browser";
import type { DeleteAccountResponse } from "@/types";

/**
 * S-08: the account-deletion control and its confirmation gate (FR-011 / US-03).
 *
 * The only interactive part of `/account`, so the only part that is a React island. Everything
 * about the danger zone that can be static is rendered by the page.
 *
 * Two properties are load-bearing:
 *
 *   1. **The gate is `confirmationMatches` — the same module the server uses.** Not a local
 *      re-implementation: a client that enables the button under rules the server rejects would
 *      make a user confirm an irreversible erasure and hand them a 400 instead.
 *   2. **The server decides, always.** The gate here is friction, not authorization. Deleting is
 *      still the route's call, against the session it verifies itself.
 */

/**
 * Network seam for the delete request, extracted so it is testable without a DOM. Returns the
 * parsed envelope, or `null` when the request never completed.
 *
 * S-07 rule: `null` — a transport failure — is the ONLY path that reports from the client. Every
 * non-ok envelope was already reported server-side with a precise location, and a confirmation
 * mismatch is user input, not a defect.
 */
export async function postAccountDelete(confirmation: string): Promise<DeleteAccountResponse | null> {
  try {
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    return (await response.json()) as DeleteAccountResponse;
  } catch (caught) {
    reportErrorClient(caught, { error_location: "client:account-delete" });
    return null;
  }
}

export default function DeleteAccountPanel({
  accountEmail,
  configured,
  locale,
}: {
  accountEmail: string;
  /** False when the deployment has no `SUPABASE_SECRET_KEY`: the route could only ever 503. */
  configured: boolean;
  locale: UiLocale;
}) {
  const copy = getMessages(locale).account;
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();

  const matches = confirmationMatches(typed, accountEmail);

  function close() {
    setOpen(false);
    setTyped("");
  }

  async function confirmDelete() {
    // Re-check the gate here rather than trusting the disabled attribute: this handler is what a
    // keyboard Enter or a stale render could reach.
    if (deleting || !matches) return;
    setDeleting(true);
    setError(null);
    try {
      const data = await postAccountDelete(typed);
      if (data === null) {
        setError(copy.errors.delete_failed);
      } else if (data.ok) {
        // The account is gone; there is no signed-in view left to render. A full navigation (not a
        // client-side state change) is what drops every in-memory trace of the deleted session.
        window.location.assign(data.redirectTo);
        return;
      } else {
        setError(copy.errors[data.error]);
      }
    } finally {
      setDeleting(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700" role="note">
        {copy.danger.unavailable}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:ring-3 focus-visible:ring-red-700/30 focus-visible:outline-none"
      >
        {copy.danger.deleteCta}
      </button>

      {open && (
        <ConfirmDialog
          title={copy.dialog.title}
          body={
            <>
              <span className="block">{copy.dialog.body}</span>
              <label htmlFor={inputId} className="mt-4 block text-sm font-medium text-slate-950">
                {copy.dialog.emailLabel}
              </label>
              <input
                id={inputId}
                type="email"
                value={typed}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={hintId}
                onChange={(event) => {
                  setTyped(event.target.value);
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none"
              />
              <span id={hintId} className="mt-2 block text-xs text-slate-500">
                {copy.dialog.emailHint(accountEmail)}
              </span>
            </>
          }
          confirmLabel={deleting ? copy.dialog.deleting : copy.dialog.confirm}
          cancelLabel={copy.dialog.cancel}
          confirmDisabled={deleting || !matches}
          onConfirm={() => {
            void confirmDelete();
          }}
          onCancel={close}
        />
      )}
    </div>
  );
}
