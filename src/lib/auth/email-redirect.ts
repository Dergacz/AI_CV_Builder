/**
 * Where the links inside Supabase confirmation emails send people.
 *
 * GoTrue builds those links from the project's `Site URL` unless the call that sends the mail passes
 * an `emailRedirectTo`. Omitting it is how every production signup ended up pointing at
 * `http://localhost:4321` (S-10). Both senders — `/api/auth/signup` and `/api/auth/resend` — go
 * through this helper so they cannot drift, and so the next sender (password reset, magic link)
 * inherits the decision.
 *
 * The origin comes from the request rather than an env var: local dev, E2E, and production each get
 * their own host with nothing to configure, and there is no deploy-time secret whose omission would
 * silently reintroduce this exact defect.
 *
 * Two constraints shape the destination path:
 *
 *  - GoTrue **silently discards** a `redirect_to` that is not on the project's allow-list, falling
 *    back to `Site URL` (see `supabase/config.toml`). Supabase documents the allow-list wildcards but
 *    not whether query strings participate in matching, so the path carries no query parameters —
 *    one exact allow-list entry per host is enough, no wildcard required.
 *  - `/auth/confirm` is deliberately separate from `/auth/callback`: the latter owns the Google
 *    round-trip and its consent stamping, which a password signup has already done at registration.
 */
export const EMAIL_CONFIRM_PATH = "/auth/confirm";

/** Absolute URL of the confirmation landing route on the origin that served `requestUrl`. */
export function emailConfirmRedirectUrl(requestUrl: URL): string {
  return new URL(EMAIL_CONFIRM_PATH, requestUrl).toString();
}
