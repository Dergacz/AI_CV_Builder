import { OBSERVABILITY_ID_SALT } from "astro:env/server";
import { POLICY_VERSION } from "@/lib/legal/policy";

/**
 * Short-lived, HMAC-signed cookie that carries a user's Terms/Privacy consent across the Google
 * OAuth redirect. The signup-page Google button sets it before redirecting to Google; the
 * `/auth/callback` route reads it to stamp consent on a brand-new account, then clears it.
 *
 * It is server-set + httpOnly + signed so the callback can trust that the consent decision
 * originated from our own consent-gated form and was not forged. The signing key is reused from
 * the observability HMAC salt (`OBSERVABILITY_ID_SALT`) — an already-configured server secret —
 * rather than introducing a new required secret whose omission in prod would silently break every
 * Google signup. If the secret is absent the helper fails closed: it writes nothing and reads null.
 */
const COOKIE_NAME = "oauth_consent";
// Long enough for the Google round-trip, short enough that a leaked cookie expires quickly.
const MAX_AGE_SECONDS = 60 * 10;

export interface ConsentRecord {
  version: string;
  acceptedAt: string;
}

interface ConsentCookies {
  get(name: string): { value: string } | undefined;
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
  delete(name: string, options?: { path: string }): void;
}

function signingKey(): string | null {
  const salt = OBSERVABILITY_ID_SALT?.trim();
  if (!salt) {
    return null;
  }
  return salt;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return bytesToHex(signature);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function setConsentCookie(cookies: ConsentCookies, record?: ConsentRecord): Promise<void> {
  const key = signingKey();
  if (!key) {
    return;
  }
  const payload: ConsentRecord = record ?? { version: POLICY_VERSION, acceptedAt: new Date().toISOString() };
  const message = `${payload.version}|${payload.acceptedAt}`;
  const signature = await sign(message, key);
  cookies.set(COOKIE_NAME, `${message}|${signature}`, {
    httpOnly: true,
    maxAge: MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: !import.meta.env.DEV,
  });
}

export async function readConsentCookie(cookies: ConsentCookies): Promise<ConsentRecord | null> {
  const key = signingKey();
  if (!key) {
    return null;
  }
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  const parts = raw.split("|");
  if (parts.length !== 3) {
    return null;
  }
  const [version, acceptedAt, signature] = parts;
  const expected = await sign(`${version}|${acceptedAt}`, key);
  if (!safeEqual(signature, expected)) {
    return null;
  }
  return { version, acceptedAt };
}

export function clearConsentCookie(cookies: ConsentCookies): void {
  cookies.delete(COOKIE_NAME, { path: "/" });
}
