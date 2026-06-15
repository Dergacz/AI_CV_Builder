import type { UiLocale } from "@/lib/i18n/locales";
import { getMessages } from "@/lib/i18n/messages";

export const authErrorCodes = [
  "auth_unavailable",
  "signin_failed",
  "signup_failed",
  "rate_limited",
  "email_not_confirmed",
] as const;

export type AuthErrorCode = (typeof authErrorCodes)[number];

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === "string" && authErrorCodes.includes(value as AuthErrorCode);
}

export function resolveAuthErrorCode(value: unknown, fallback: AuthErrorCode): AuthErrorCode {
  return isAuthErrorCode(value) ? value : fallback;
}

export function classifyAuthError(error: { status?: number; code?: string }, fallback: AuthErrorCode): AuthErrorCode {
  if (error.status === 429 || error.code?.includes("rate_limit")) {
    return "rate_limited";
  }
  if (error.code === "email_not_confirmed") {
    return "email_not_confirmed";
  }

  return fallback;
}

export function getAuthErrorMessage(locale: UiLocale, code: AuthErrorCode): string {
  return getMessages(locale).auth.errors[code];
}
