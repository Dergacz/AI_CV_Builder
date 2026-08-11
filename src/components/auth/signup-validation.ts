import type { SignUpFormCopy } from "@/lib/i18n/messages";

export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignUpValues {
  email: string;
  password: string;
  confirmPassword: string;
  consent: boolean;
}

export interface SignUpErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  consent?: string;
}

/**
 * Pure, DOM-free validation for the signup form. Extracted from the component so the
 * gate (including the consent requirement) is unit-testable without a React renderer.
 */
export function validateSignUp(values: SignUpValues, copy: SignUpFormCopy): SignUpErrors {
  const errors: SignUpErrors = {};

  if (!values.email.trim()) {
    errors.email = copy.validation.emailRequired;
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = copy.validation.emailInvalid;
  }

  if (!values.password) {
    errors.password = copy.validation.passwordRequired;
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = copy.validation.passwordTooShort(MIN_PASSWORD_LENGTH);
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = copy.validation.confirmPasswordRequired;
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = copy.validation.passwordsMismatch;
  }

  if (!values.consent) {
    errors.consent = copy.validation.consentRequired;
  }

  return errors;
}
