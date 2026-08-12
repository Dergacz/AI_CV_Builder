import type { UiLocale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Success counterpart to `auth-errors.ts`: the good news an auth page can be asked to show via a
 * query param. Same allow-list discipline — a `?notice=` value that is not one of these codes
 * resolves to nothing, so the banner can only ever render copy we wrote, never text from the URL.
 *
 * `email_confirmed` exists for the confirmation link opened on a device that did not sign up (the
 * PKCE verifier cookie lives in the signup browser). The address really is verified at that point;
 * only the session is missing, so the user needs a sign-in prompt, not an error. See
 * `src/pages/auth/confirm.ts`.
 */
export const authNoticeCodes = ["email_confirmed"] as const;

export type AuthNoticeCode = (typeof authNoticeCodes)[number];

export function isAuthNoticeCode(value: unknown): value is AuthNoticeCode {
  return typeof value === "string" && authNoticeCodes.includes(value as AuthNoticeCode);
}

export function getAuthNoticeMessage(locale: UiLocale, code: AuthNoticeCode): string {
  return getMessages(locale).auth.notices[code];
}
