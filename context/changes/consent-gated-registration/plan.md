# Consent-Gated Registration Implementation Plan

## Overview

Require every new user to affirmatively accept a single combined Terms of Service + Privacy Policy consent before their registration is allowed to proceed. Consent is gated at two layers — inline client-side validation in the signup form (matching the existing field-validation UX) and an unbypassable server-side check in the signup API route — and the consent text links to placeholder `/terms` and `/privacy` routes. No consent is persisted; the gate is enforcement-only.

## Current State Analysis

Registration today is a two-layer flow with no consent requirement:

- **Client**: `src/components/auth/SignUpForm.tsx` is a React island with a `validate()` function (`SignUpForm.tsx:27`) that checks email/password/confirm on submit, sets field-level `errors`, and calls `e.preventDefault()` when invalid. Errors render via `FormField` (`src/components/auth/FormField.tsx`), which is **input-oriented** — it always renders a text `<input>` with a `value: string` / `onChange: (string) => void` contract and a left icon, so it does not fit a checkbox.
- **Server**: `src/pages/api/auth/signup.ts:6` reads `email`/`password` from `FormData`, calls `supabase.auth.signUp`, emits the `funnel_signup_completed` event on success, and redirects to `/dashboard` or `/auth/confirm-email`. This is the real enforcement point — a direct POST bypasses all client validation.
- **Copy**: All auth strings are typed and localized across **en/pl/ru** in `src/lib/i18n/messages.ts`. The signup form copy is shaped by the `SignUpFormCopy` interface (`messages.ts:22`) and lives in three locale blocks. TypeScript enforces that every locale supplies every field — a missing translation is a compile error.
- **Errors**: Server-side auth failures flow through a typed code system in `src/lib/i18n/auth-errors.ts` — `authErrorCodes` is a `const` tuple (`auth-errors.ts:4`), and each code must have an entry in the `auth.errors` map of all three locales (`messages.ts:320` for en).
- **Tests**: Sources have adjacent Vitest tests. `src/pages/api/auth/signup.test.ts` mocks Supabase + observability and exercises the route directly; the form has no test yet.
- **Missing**: No `/terms` or `/privacy` route exists, and there is no consent column, table, or metadata write anywhere in `supabase/migrations/`.

## Desired End State

After this plan:

- The signup form shows a required consent checkbox with text like "I agree to the Terms of Service and Privacy Policy", where "Terms of Service" and "Privacy Policy" are links to `/terms` and `/privacy`.
- Submitting with the box unchecked produces an inline field-level error (same look/behavior as email/password errors) and does **not** POST.
- A direct POST to `/api/auth/signup` without the consent field is rejected with a redirect to `/auth/signup?error=consent_required` **before** `supabase.auth.signUp` is ever called — no account is created.
- The `consent_required` error message renders correctly in all three locales.
- `npm run lint`, `astro check`, and `npm test` all pass; the new route and form tests lock both enforcement layers.

Verification: see per-phase Success Criteria.

### Key Discoveries:

- `FormField` (`FormField.tsx:8`) is text-input-only — a checkbox needs a dedicated component (`checked`/`onChange(boolean)`, label-to-the-right, inline links), not a `FormField` overload.
- `SignUpForm.validate()` (`SignUpForm.tsx:27`) is the single client gate; adding a `consent` key to the `errors` state object and the validate body follows the existing pattern exactly.
- The server route (`signup.ts:15`) is the only unbypassable gate; the consent check must sit **before** the `signUp` call so no account is created on rejection.
- Adding `consent_required` to `authErrorCodes` (`auth-errors.ts:4`) makes TypeScript force a translation in all three `auth.errors` maps — this is the i18n safety net.
- The route already redirects to `/auth/signup?error=<code>` (`signup.ts:18`) and the page resolves it via `resolveAuthErrorCode(error, "signup_failed")` (`signup.astro:12`) — `consent_required` plugs into that existing path with no page change needed.

## What We're NOT Doing

- **Not persisting consent** — no timestamp, version, user-metadata write, column, or consent-events table. The gate enforces consent but stores nothing beyond the act of registering.
- **Not authoring legal content** — `/terms` and `/privacy` are referenced as placeholder routes. Creating those pages (and their localized content) is a tracked follow-up, out of scope here.
- **Not adding marketing/optional consents** — single combined required checkbox only.
- **Not adding an E2E test** — coverage is unit (route + form) plus compiler-enforced i18n. A Playwright test is a possible later `/10x-e2e` follow-up.
- **Not changing the confirm-email / session redirect logic** in the signup route beyond inserting the consent gate.

## Implementation Approach

Build bottom-up so each phase compiles on the one before it. Phase 1 lays the typed copy + error code (pure types/strings, compiler-validated across locales). Phase 2 consumes that copy in a new `ConsentCheckbox` component and the form's validate flow. Phase 3 adds the server gate and tests. The consent field is a standard checkbox named so it serializes into `FormData`; the server treats "field present and truthy" as consent given.

## Critical Implementation Details

- **State sequencing (server)**: the consent check must run *before* `supabase.auth.signUp` in `signup.ts`. Placing it after would create the account and then reject — defeating the gate and leaving an orphan unconfirmed user.
- **Checkbox serialization**: an unchecked HTML checkbox submits **no** field at all (not `"false"`). The server contract is therefore "field absent or not truthy → rejected", not a string compare against `"false"`.

## Phase 1: i18n + Error-Code Plumbing

### Overview

Add the consent copy to the typed signup form messages across all three locales, and register a `consent_required` server-error code with its localized messages. This phase is pure types + strings; TypeScript guarantees no locale is left behind.

### Changes Required:

#### 1. Signup form copy type + strings

**File**: `src/lib/i18n/messages.ts`

**Intent**: Add consent-related copy to the signup form so the checkbox label, its inline link texts, and the "must accept" validation message are localized. Then supply the strings in the en, pl, and ru `form.signup` blocks.

**Contract**: Extend `SignUpFormCopy` (`messages.ts:22`) with a `consent` group: a label/prefix string, link-text strings for Terms and Privacy (so the component can wrap them in `<a>`), and a `validation.consentRequired` string (added to the existing `validation` intersection). Mirror the new fields in all three `form.signup` blocks (en ~`messages.ts:296`, pl ~`555`, ru ~`814`). No code snippet — follow the surrounding copy shape.

#### 2. `consent_required` error code

**File**: `src/lib/i18n/auth-errors.ts`

**Intent**: Register a new auth error code so the server can redirect with `?error=consent_required` and the signup page resolves a real localized message.

**Contract**: Add `"consent_required"` to the `authErrorCodes` tuple (`auth-errors.ts:4`). No other change here — `isAuthErrorCode`/`resolveAuthErrorCode` derive from the tuple.

#### 3. Localized error message

**File**: `src/lib/i18n/messages.ts`

**Intent**: Provide the user-facing message shown when a consent-less request is rejected server-side.

**Contract**: Add a `consent_required` entry to the `auth.errors` map in all three locales (en ~`messages.ts:320`, pl, ru). Adding the code in change #2 makes these mandatory (compile error otherwise).

### Success Criteria:

#### Automated Verification:

- Type checking passes (proves all 3 locales supply consent copy + error message): `npx astro check`
- Existing i18n tests pass: `npm test -- src/lib/i18n`
- Linting passes: `npm run lint`

#### Manual Verification:

- The three locale `consent_required` messages read naturally and match each locale's existing tone.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Client Gate (Form)

### Overview

Add a required consent checkbox to the signup form with inline error handling consistent with the existing email/password fields, rendered by a new checkbox component that supports inline Terms/Privacy links.

### Changes Required:

#### 1. Consent checkbox component

**File**: `src/components/auth/ConsentCheckbox.tsx` (new)

**Intent**: Provide a labeled checkbox whose label contains inline links to `/terms` and `/privacy`, with the same error-display treatment (red text + alert icon) as `FormField`. `FormField` can't be reused because it renders a text input; this is a small sibling component.

**Contract**: Props: `id`, `name`, `checked: boolean`, `onChange: (checked: boolean) => void`, `error?: string`, and the consent copy (label/prefix + Terms/Privacy link labels). Renders `<input type="checkbox" name=...>` so it serializes into `FormData`, the consent sentence with two `<a href="/terms">`/`<a href="/privacy">` links, and an inline error row mirroring `FormField.tsx:60`. Accessible label association (checkbox `id` ↔ `<label htmlFor>`).

#### 2. Wire consent into the form

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Track consent state, block submission when unchecked with an inline error, and clear the error on change — following the existing `validate()` / `clearError()` pattern.

**Contract**: Add a `consent` boolean state and a `consent?: string` key to the `errors` type (`SignUpForm.tsx:25`). In `validate()` (`SignUpForm.tsx:27`), set `next.consent = copy.consent.validation...` when `!consent`. Render `<ConsentCheckbox>` before `<ServerError>` (`SignUpForm.tsx:133`), passing `copy.consent`, state, and `clearError("consent")` on change. The checkbox `name` ensures it posts.

#### 3. Form validation test

**File**: `src/components/auth/SignUpForm.test.tsx` (new)

**Intent**: Lock that an unchecked consent box blocks submission and a checked one (with valid fields) does not, so the client gate can't silently regress.

**Contract**: Render `SignUpForm`, fill valid email/password/confirm, submit without checking consent → assert the consent validation message appears and no navigation/submit occurs; then check consent and submit → assert the error clears / submit proceeds. Use Testing Library role/label queries. Follow the project's existing component-test conventions (mirror how other React components are tested, if any; otherwise standard `@testing-library/react`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro check`
- Form test passes: `npm test -- src/components/auth/SignUpForm`
- Linting passes: `npm run lint`

#### Manual Verification:

- Submitting the signup form with the box unchecked shows an inline error and does not navigate.
- The Terms and Privacy links are clickable and point to `/terms` and `/privacy`.
- Checking the box clears the error; a valid submission proceeds.
- Checkbox + error render correctly in all three locales.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Server Enforcement

### Overview

Make the consent gate unbypassable: the signup API route rejects any request lacking truthy consent before creating an account.

### Changes Required:

#### 1. Server-side consent check

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Read the consent field from the submitted form and reject the request when it is absent/falsy, redirecting back to the signup page with the `consent_required` error — before any Supabase call, so no account is created.

**Contract**: After reading the form (`signup.ts:8`) and before the `createClient`/`signUp` calls, read the consent field and, when not truthy, `return context.redirect("/auth/signup?error=consent_required")`. Remember an unchecked checkbox sends no field at all, so treat absent as not-consented. No change to the existing success/funnel/redirect logic.

#### 2. Route test for the gate

**File**: `src/pages/api/auth/signup.test.ts`

**Intent**: Lock both that a consent-less POST is rejected without calling `signUp`, and that a consented POST still reaches `signUp` (existing behavior preserved).

**Contract**: Add cases to the existing suite: (a) POST without the consent field → `Location` is `/auth/signup?error=consent_required` and `mocks.signUp` is **not** called; (b) update the existing success-path contexts to include the consent field so they still pass. Extend the `makeContext` form payload accordingly.

### Success Criteria:

#### Automated Verification:

- Route tests pass: `npm test -- src/pages/api/auth/signup`
- Full unit suite passes: `npm test`
- Type checking passes: `npx astro check`
- Linting passes: `npm run lint`

#### Manual Verification:

- A direct POST (e.g. `curl`) to `/api/auth/signup` without the consent field redirects to `?error=consent_required` and creates no user.
- A normal browser signup with consent checked still completes (dashboard or confirm-email as before).

**Implementation Note**: After completing this phase and all automated verification passes, pause for final manual confirmation.

---

## Testing Strategy

### Unit Tests:

- **Form** (`SignUpForm.test.tsx`): unchecked consent blocks submit + shows inline error; checked consent + valid fields proceeds.
- **Route** (`signup.test.ts`): missing consent → `consent_required` redirect, `signUp` not called; present consent → existing success path intact.

### Integration Tests:

- None added. The route test already exercises the server contract end-to-end against mocked Supabase.

### Manual Testing Steps:

1. Load `/auth/signup` in each locale; confirm the consent checkbox + linked Terms/Privacy render.
2. Submit with the box unchecked → inline error, no navigation.
3. Check the box, submit valid credentials → proceeds to confirm-email/dashboard.
4. `curl -X POST /api/auth/signup` with email+password but no consent → redirect to `?error=consent_required`, no account created.
5. Click the Terms and Privacy links → land on `/terms` and `/privacy` (placeholder until content is authored).

## Performance Considerations

None. The change adds a synchronous boolean check on the server and a checkbox in the form — no new I/O, queries, or network calls.

## Migration Notes

No data model change and no migration. Consent is enforcement-only and not persisted. If a future change requires proof-of-consent, that is a separate plan (column/metadata or consent-events table).

## References

- Signup form: `src/components/auth/SignUpForm.tsx`
- Signup route: `src/pages/api/auth/signup.ts`
- Field component (pattern, not reused): `src/components/auth/FormField.tsx`
- i18n messages: `src/lib/i18n/messages.ts` (`SignUpFormCopy` at `messages.ts:22`)
- Auth error codes: `src/lib/i18n/auth-errors.ts`
- Route test pattern: `src/pages/api/auth/signup.test.ts`
- Follow-up: author `/terms` and `/privacy` pages (out of scope here)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: i18n + Error-Code Plumbing

#### Automated

- [x] 1.1 Type checking passes (all 3 locales supply consent copy + error message): `npx astro check` — 1c86e5f
- [x] 1.2 Existing i18n tests pass: `npm test -- src/lib/i18n` — 1c86e5f
- [x] 1.3 Linting passes: `npm run lint` — 1c86e5f

#### Manual

- [x] 1.4 Three locale `consent_required` messages read naturally and match each locale's tone — 1c86e5f

### Phase 2: Client Gate (Form)

#### Automated

- [x] 2.1 Type checking passes: `npx astro check`
- [x] 2.2 Form test passes: `npm test -- src/components/auth/SignUpForm`
- [x] 2.3 Linting passes: `npm run lint`

#### Manual

- [x] 2.4 Unchecked box shows inline error and does not navigate
- [x] 2.5 Terms and Privacy links point to `/terms` and `/privacy`
- [x] 2.6 Checking the box clears the error; valid submission proceeds
- [x] 2.7 Checkbox + error render correctly in all three locales

### Phase 3: Server Enforcement

#### Automated

- [ ] 3.1 Route tests pass: `npm test -- src/pages/api/auth/signup`
- [ ] 3.2 Full unit suite passes: `npm test`
- [ ] 3.3 Type checking passes: `npx astro check`
- [ ] 3.4 Linting passes: `npm run lint`

#### Manual

- [ ] 3.5 Direct POST without consent redirects to `?error=consent_required` and creates no user
- [ ] 3.6 Normal browser signup with consent checked still completes
