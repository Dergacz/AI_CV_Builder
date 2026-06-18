import { describe, expect, it } from "vitest";

import { validateSignUp } from "@/components/auth/signup-validation";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Consent-gate validation (plan phase 2). The signup form is stateful, and this repo has no
 * DOM test setup, so the gate logic is extracted into the pure validateSignUp() helper and
 * exercised directly — mirroring the project's "test the pure part" convention.
 */

const copy = getMessages("en").auth.form.signup;

const validBase = {
  email: "ada@example.com",
  password: "pw-123456",
  confirmPassword: "pw-123456",
};

describe("validateSignUp — consent gate", () => {
  it("blocks submission when consent is unchecked, even with otherwise-valid fields", () => {
    const errors = validateSignUp({ ...validBase, consent: false }, copy);

    expect(errors.consent).toBe(copy.validation.consentRequired);
    expect(errors.email).toBeUndefined();
    expect(errors.password).toBeUndefined();
    expect(errors.confirmPassword).toBeUndefined();
  });

  it("passes with consent checked and valid fields", () => {
    const errors = validateSignUp({ ...validBase, consent: true }, copy);

    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("still reports field errors alongside the consent error", () => {
    const errors = validateSignUp({ email: "", password: "", confirmPassword: "", consent: false }, copy);

    expect(errors.email).toBe(copy.validation.emailRequired);
    expect(errors.password).toBe(copy.validation.passwordRequired);
    expect(errors.consent).toBe(copy.validation.consentRequired);
  });
});
