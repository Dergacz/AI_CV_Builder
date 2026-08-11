import { track, type Identity } from "./index";

const OBSERVABILITY_CONFIRMED_COOKIE = "obs_confirmed";
// Email confirmation happens once per account lifetime; keep the marker long-lived so it suppresses
// per-request re-emits. The cookie is the authoritative once-guard: with person profiles off PostHog
// does NOT dedupe raw captures, but a funnel query first-touches per distinct_id, so a stray repeat
// would inflate raw counts without distorting conversion.
const OBSERVABILITY_CONFIRMED_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

interface ConfirmCookies {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options: { httpOnly: boolean; maxAge: number; path: string; sameSite: "lax"; secure: boolean },
  ): void;
}

interface ConfirmableUser {
  email_confirmed_at?: string | null;
}

/**
 * Emit funnel_email_confirmed at most once per browser. Step 3 has no API hook — confirm-email.astro
 * is static and Supabase confirms via an out-of-band link — so we observe the real auth state
 * (`email_confirmed_at`) on the first authenticated request and guard re-fires with a marker cookie.
 * Returns true iff the event was emitted this call. The cookie is the authoritative guard — PostHog
 * does not dedupe raw captures with person profiles off; funnel queries first-touch per distinct_id.
 */
export async function trackEmailConfirmedOnce(
  user: ConfirmableUser | null,
  cookies: ConfirmCookies,
  identity: Identity,
  locale: string,
): Promise<boolean> {
  if (!user?.email_confirmed_at) {
    return false;
  }
  if (cookies.get(OBSERVABILITY_CONFIRMED_COOKIE)?.value) {
    return false;
  }
  cookies.set(OBSERVABILITY_CONFIRMED_COOKIE, "1", {
    httpOnly: true,
    maxAge: OBSERVABILITY_CONFIRMED_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  await track("funnel_email_confirmed", { locale }, identity);
  return true;
}
