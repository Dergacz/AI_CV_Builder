import React, { useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { ConsentCheckbox } from "@/components/auth/ConsentCheckbox";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { MIN_PASSWORD_LENGTH, validateSignUp, type SignUpErrors } from "@/components/auth/signup-validation";
import { getMessages } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";

interface Props {
  locale: UiLocale;
  serverError?: string | null;
}

export default function SignUpForm({ locale, serverError }: Props) {
  const copy = getMessages(locale).auth.form.signup;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<SignUpErrors>({});

  function validate() {
    const next = validateSignUp({ email, password, confirmPassword, consent }, copy);
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  const passwordHint =
    !errors.password && password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
      <p className="mt-1 text-xs text-slate-400">{copy.passwordHint(MIN_PASSWORD_LENGTH - password.length)}</p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={copy.emailLabel}
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder={copy.emailPlaceholder}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label={copy.passwordLabel}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder={copy.passwordPlaceholder}
        error={errors.password}
        hint={passwordHint}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            hiddenLabel={copy.passwordToggle.show}
            visibleLabel={copy.passwordToggle.hide}
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label={copy.confirmPasswordLabel}
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder={copy.confirmPasswordPlaceholder}
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            hiddenLabel={copy.passwordToggle.show}
            visibleLabel={copy.passwordToggle.hide}
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ConsentCheckbox
        id="consent"
        name="consent"
        checked={consent}
        onChange={(value) => {
          setConsent(value);
          clearError("consent");
        }}
        error={errors.consent}
        copy={copy.consent}
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText={copy.submitting} icon={<UserPlus className="size-4" />}>
        {copy.submit}
      </SubmitButton>
    </form>
  );
}
