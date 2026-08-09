/**
 * S-08: the confirmation gate, shared verbatim by the browser and the server.
 *
 * Deletion is irreversible, so the gate must be identical on both sides — a client that enables
 * the confirm button under rules the server does not accept produces a user who confirms an
 * erasure and gets a 400 instead. This lives in its own module (not in the account-deletion
 * service, and not in `supabase-admin.ts`) purely so the React island can import it without
 * dragging `astro:env/server` and the Supabase admin client into the client bundle — the same
 * split `client.browser.ts` maintains against `observability/index.ts`.
 *
 * The gate is "type your own email address": deliberate, impossible to trigger by an incidental
 * click, works identically for password and Google-only accounts (S-04), and needs no translated
 * magic word.
 */

/**
 * Whether the typed confirmation matches the account's own email.
 *
 * Case-insensitive and whitespace-trimmed: the user is retyping something they can see on screen,
 * and rejecting "Ada@Example.com" for the casing would be friction with no security value — the
 * value is the deliberateness of typing it, not the keystroke fidelity. An absent or blank account
 * email always fails closed, so a session without an email can never satisfy the gate.
 */
export function confirmationMatches(typed: string, accountEmail: string | null | undefined): boolean {
  const expected = accountEmail?.trim().toLowerCase();
  if (!expected) {
    return false;
  }
  return typed.trim().toLowerCase() === expected;
}
