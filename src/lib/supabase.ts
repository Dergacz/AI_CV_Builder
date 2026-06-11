import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";
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
export async function safeGetUser(supabase: SupabaseClient<Database>): Promise<User | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      await clearStaleSession(supabase);
      return null;
    }
    return user ?? null;
  } catch {
    await clearStaleSession(supabase);
    return null;
  }
}

async function clearStaleSession(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Best-effort cookie purge; nothing actionable if sign-out itself fails.
    // eslint-disable-next-line no-console
    console.warn("supabase/safeGetUser: failed to clear stale session");
  }
}
