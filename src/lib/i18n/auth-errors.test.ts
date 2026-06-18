import { describe, expect, it } from "vitest";

import { uiLocales } from "@/lib/i18n/locales";
import {
  authErrorCodes,
  classifyAuthError,
  getAuthErrorMessage,
  isAuthErrorCode,
  resolveAuthErrorCode,
} from "@/lib/i18n/auth-errors";

describe("auth error localization contract", () => {
  it("defines stable auth error codes", () => {
    expect(authErrorCodes).toEqual([
      "auth_unavailable",
      "signin_failed",
      "signup_failed",
      "consent_required",
      "rate_limited",
      "email_not_confirmed",
    ]);
  });

  it("recognizes only supported auth error codes", () => {
    expect(isAuthErrorCode("signin_failed")).toBe(true);
    expect(isAuthErrorCode("signup_failed")).toBe(true);
    expect(isAuthErrorCode("raw English prose")).toBe(false);
    expect(isAuthErrorCode(undefined)).toBe(false);
  });

  it("resolves unknown values to the requested fallback code", () => {
    expect(resolveAuthErrorCode("rate_limited", "signin_failed")).toBe("rate_limited");
    expect(resolveAuthErrorCode("Account access is temporarily unavailable.", "signin_failed")).toBe("signin_failed");
    expect(resolveAuthErrorCode(null, "signup_failed")).toBe("signup_failed");
  });

  it("maps provider rate-limit errors to the stable rate_limited code", () => {
    expect(classifyAuthError({ status: 429 }, "signin_failed")).toBe("rate_limited");
    expect(classifyAuthError({ code: "over_email_send_rate_limit" }, "signup_failed")).toBe("rate_limited");
    expect(classifyAuthError({ status: 400, code: "invalid_credentials" }, "signin_failed")).toBe("signin_failed");
  });

  it("maps unconfirmed email signin errors while preserving fallback behavior", () => {
    expect(classifyAuthError({ status: 400, code: "email_not_confirmed" }, "signin_failed")).toBe(
      "email_not_confirmed",
    );
    expect(classifyAuthError({ status: 400, code: "invalid_credentials" }, "signin_failed")).toBe("signin_failed");
  });

  it("returns localized display copy for every supported locale", () => {
    for (const locale of uiLocales) {
      for (const code of authErrorCodes) {
        const message = getAuthErrorMessage(locale, code);
        expect(message.length).toBeGreaterThan(12);
        expect(message).not.toBe(code);
      }
    }
  });
});
