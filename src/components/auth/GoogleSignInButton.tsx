import React, { useState } from "react";
import { ConsentCheckbox } from "@/components/auth/ConsentCheckbox";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";

interface Props {
  locale: UiLocale;
  intent: "signin" | "signup";
}

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
 * "Continue with Google" island used by both auth pages. On signup it carries its own consent
 * checkbox and blocks submit until it's checked — mirroring SignInForm's preventDefault gate —
 * so the OAuth redirect never starts without consent. The form POSTs to the start endpoint,
 * which sets the signed consent cookie before handing off to Google.
 */
export default function GoogleSignInButton({ locale, intent }: Props) {
  const messages = getMessages(locale);
  const copy = messages.auth.google;
  const signupCopy = messages.auth.form.signup;

  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>(undefined);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (intent === "signup" && !consent) {
      e.preventDefault();
      setConsentError(signupCopy.validation.consentRequired);
    }
  }

  return (
    <form method="POST" action="/api/auth/oauth/google" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <input type="hidden" name="intent" value={intent} />

      {intent === "signup" ? (
        <ConsentCheckbox
          id="google-consent"
          name="consent"
          checked={consent}
          onChange={(value) => {
            setConsent(value);
            if (value) setConsentError(undefined);
          }}
          error={consentError}
          copy={signupCopy.consent}
        />
      ) : null}

      <Button
        type="submit"
        variant="outline"
        className="w-full rounded-lg border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
      >
        <GoogleIcon />
        {copy.button}
      </Button>
    </form>
  );
}
