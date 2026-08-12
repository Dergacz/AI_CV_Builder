import { describe, expect, it } from "vitest";

import { uiLocales } from "@/lib/i18n/locales";
import { authNoticeCodes, getAuthNoticeMessage, isAuthNoticeCode } from "@/lib/i18n/auth-notices";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Notice-channel contract (S-10, R-08/R-16).
 *
 * The guard is the only thing standing between a `?notice=` query param and rendered page copy —
 * unlike the error channel there is no fallback code, so an unrecognized value must resolve to
 * nothing rather than to a default message.
 */
describe("auth notice localization contract", () => {
  it("defines stable auth notice codes", () => {
    expect(authNoticeCodes).toEqual(["email_confirmed"]);
  });

  it("recognizes only supported notice codes", () => {
    expect(isAuthNoticeCode("email_confirmed")).toBe(true);
    expect(isAuthNoticeCode("Your email is confirmed.")).toBe(false);
    expect(isAuthNoticeCode("email_not_confirmed")).toBe(false);
    expect(isAuthNoticeCode(undefined)).toBe(false);
    expect(isAuthNoticeCode(null)).toBe(false);
  });

  it("returns localized display copy for every supported locale", () => {
    for (const locale of uiLocales) {
      for (const code of authNoticeCodes) {
        const message = getAuthNoticeMessage(locale, code);
        expect(message.length).toBeGreaterThan(12);
        expect(message).not.toBe(code);
      }
    }
  });

  it("keeps the confirmed notice distinct from the unconfirmed error in every locale", () => {
    // The two say opposite things; a copy-paste between catalogs would tell a confirmed user their
    // email is still unverified.
    for (const locale of uiLocales) {
      const messages = getMessages(locale);
      expect(messages.auth.notices.email_confirmed).not.toBe(messages.auth.errors.email_not_confirmed);
    }
  });
});
