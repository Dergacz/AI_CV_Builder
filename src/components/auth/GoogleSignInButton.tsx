import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";

interface Props {
  locale: UiLocale;
}

const CONSENT_NOTICE_ID = "google-consent-notice";

/** The Google "G" mark — lucide-react carries no brand logos, so it's inlined. */
function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.55 14.67a6.9 6.9 0 0 1 0-4.34V7.35H1.71a11.5 11.5 0 0 0 0 10.3l3.84-2.98Z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.18 15.1 0 12 0 7.46 0 3.55 2.6 1.71 6.4l3.84 2.98C6.46 6.66 9 4.77 12 4.77Z"
      />
    </svg>
  );
}

/**
 * "Continue with Google" island used by both auth pages, identically. Consent is expressed by the
 * click itself: the notice under the button states what activating it commits to, and the start
 * endpoint records that consent in a signed cookie for `/auth/callback` to stamp onto a brand-new
 * account. `aria-describedby` ties the notice to the button so a screen reader announces the terms
 * before the control is activated, not after.
 *
 * There is deliberately no checkbox and no `intent` field — the endpoint treats every start the
 * same, because a click from the sign-in page creates an account just as readily as one from the
 * sign-up page.
 */
export default function GoogleSignInButton({ locale }: Props) {
  const copy = getMessages(locale).auth.google;

  return (
    <form method="POST" action="/api/auth/oauth/google" className="space-y-3">
      <Button
        type="submit"
        variant="outline"
        aria-describedby={CONSENT_NOTICE_ID}
        className="w-full rounded-lg border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
      >
        <GoogleIcon />
        {copy.button}
      </Button>

      <p id={CONSENT_NOTICE_ID} className="text-center text-xs leading-5 text-slate-500">
        {copy.consent.prefix}
        <a href="/terms" className="font-medium text-emerald-700 hover:underline">
          {copy.consent.termsLabel}
        </a>
        {copy.consent.conjunction}
        <a href="/privacy" className="font-medium text-emerald-700 hover:underline">
          {copy.consent.privacyLabel}
        </a>
        {copy.consent.suffix}
      </p>
    </form>
  );
}
