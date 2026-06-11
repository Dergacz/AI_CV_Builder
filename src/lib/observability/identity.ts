import { OBSERVABILITY_ID_SALT } from "astro:env/server";

const OBSERVABILITY_SESSION_COOKIE = "obs_session";
const OBSERVABILITY_SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

interface CookieValue {
  value: string;
}

interface SessionCookies {
  get(name: string): CookieValue | undefined;
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      maxAge: number;
      path: string;
      sameSite: "lax";
      secure: boolean;
    },
  ): void;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getPseudonymousUserId(userId: string): Promise<string | null> {
  const salt = OBSERVABILITY_ID_SALT?.trim();
  if (!salt) {
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(salt), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  return bytesToHex(signature);
}

export function getAnonSessionId(cookies: SessionCookies): string {
  const existing = cookies.get(OBSERVABILITY_SESSION_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const sessionId = `anon_${crypto.randomUUID()}`;
  cookies.set(OBSERVABILITY_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    maxAge: OBSERVABILITY_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  return sessionId;
}
