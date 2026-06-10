/**
 * Dedicated E2E account for storageState login.
 *
 * Stable (not timestamped) on purpose: storageState must reference one durable
 * account. On local Supabase `enable_confirmations = false`, so signup auto-creates
 * a confirmed session — `auth.setup.ts` signs in, or signs up on first run.
 *
 * NOTE: this is a throwaway local-only credential for the dockerized Supabase. Do
 * not point E2E at a real/hosted project with this file.
 */
export const TEST_USER = {
  email: "e2e-tester@example.com",
  password: "e2e-Test-Password-123",
} as const;
