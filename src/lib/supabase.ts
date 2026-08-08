import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
import { scheduleErrorReport, type SchedulableLocals } from "@/lib/observability/schedule";
import type { Database } from "@/db/database.types";

export function createClient(requestHeaders: Headers, cookies: AstroCookies) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestHeaders.get("Cookie") ?? "").map(({ name, value }) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}

/**
 * Resolve the current user without ever throwing at the SSR boundary.
 *
 * When the refresh token in the request cookies is stale/revoked (common after a
 * local Supabase reset, expiry, or sign-out elsewhere), `getUser()` throws an
 * `AuthApiError: Invalid Refresh Token` (code `refresh_token_not_found`). That is
 * a benign "no session" condition — treat it as unauthenticated, purge the
 * poisoned cookies via `signOut()` so it does not recur on every request, and
 * return null. Any other failure is also swallowed to null with a breadcrumb so
 * genuine misconfig stays visible.
 */
export async function safeGetUser(
  supabase: SupabaseClient<Database>,
  locals?: SchedulableLocals,
): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      await clearStaleSession(supabase, locals);
      return null;
    }
    return user ?? null;
  } catch {
    await clearStaleSession(supabase, locals);
    return null;
  }
}

async function clearStaleSession(supabase: SupabaseClient<Database>, locals?: SchedulableLocals): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    // S-07: replaces a pre-F-01 `console.warn`. A failed purge means the poisoned cookies survive
    // and this path re-runs on every subsequent request, so a sustained failure is worth seeing.
    //
    // `locals` is optional because middleware calls `safeGetUser` BEFORE it resolves the request's
    // observability identity — and `reportError` no-ops without a distinct_id. So the middleware
    // path stays unreported by construction; route call sites, which run after identity exists,
    // do report. Resolving identity earlier would mean resolving it twice per request.
    scheduleErrorReport(error, { error_location: "lib/supabase:safeGetUser" }, locals);
  }
}
