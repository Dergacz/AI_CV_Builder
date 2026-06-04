# Account Access For CV Work Implementation Plan

## Overview

Implement roadmap slice S-02 by turning the existing Supabase email/password auth baseline into a coherent account-access path for AI CV Builder. Users should be able to sign up, sign in, and reach a protected personal CV workspace shell without adding questionnaire, saved-CV persistence, generation, PDF export, roles, or a broader data layer.

## Current State Analysis

The app already has Supabase SSR auth wiring, signin/signup pages, auth POST endpoints, and centralized route protection for `/dashboard`. The current gap is product flow: successful signin redirects to `/`, signup always goes to a confirm-email page, and `/dashboard` still looks like a starter protected-page demo rather than the CV workspace that unblocks S-03 and S-06.

The implementation should preserve the existing `@supabase/ssr` architecture. Context7 confirmed that the current pattern of creating a per-request server client with cookie get/set methods and using `auth.getUser()` for server-side identity checks is the current SSR pattern. Supabase signup can produce either an active session or an email-confirmation flow depending on project settings, so S-02 needs session-aware signup handling.

## Desired End State

Signin success always lands the user on `/dashboard`, which is now framed as the user's personal CV workspace. Signup success sends users with an active session directly to `/dashboard`; users who must confirm email still see the confirm-email page. Auth pages look like part of AI CV Builder through a light product restyle, and server failures are mapped to safe user-facing messages.

The protected workspace at `/dashboard` presents an empty CV workspace shell with account context, signout, and a visible disabled/coming-next "Start CV" action. This prepares the workspace entry point for S-03 without creating the questionnaire route and prepares the workspace surface for S-06 without implementing saved-CV persistence.

### Key Discoveries:

- Route protection is centralized through `PROTECTED_ROUTES`, currently only `"/dashboard"`: `src/middleware.ts:4`.
- Middleware already sets `Astro.locals.user` from `supabase.auth.getUser()`: `src/middleware.ts:10`.
- The Supabase SSR helper returns `null` when `SUPABASE_URL` or `SUPABASE_KEY` is missing and wires request/response cookies: `src/lib/supabase.ts:5`.
- Signin currently redirects successful users to `/`, not the workspace: `src/pages/api/auth/signin.ts:19`.
- Signup currently redirects all successful signups to `/auth/confirm-email`: `src/pages/api/auth/signup.ts:19`.
- `/dashboard` is protected but only renders starter-style dashboard copy, user email, and signout: `src/pages/dashboard.astro:7`.
- S-01 already treats signed-in `/dashboard` as the temporary continuation target: `src/components/ProductLanding.astro:6`.
- The roadmap defines S-02 as "user can sign up, log in, and reach the CV workspace": `context/foundation/roadmap.md:108`.
- F-02 explicitly excludes saved CV implementation work and broad data-layer scope from the current planning surface: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md:234`.

## What We're NOT Doing

- No questionnaire route, questionnaire UI, answer capture, or "Start CV" navigation to a future route.
- No CV generation, generated draft UI, loading state, or AI integration.
- No Supabase migration, `public.cvs` table, saved-CV API route, saved-CV library, save/reopen/delete behavior, or generated database types.
- No PDF export, persisted PDF storage, storage buckets, queues, workers, analytics, or background processing.
- No roles, teams, workspaces in the multi-user sense, sharing, collaborators, public links, or admin model.
- No full auth redesign, OAuth provider, password reset, magic link, MFA, profile settings, billing, or account management area.
- No changes to the existing Supabase SSR auth architecture.
- No roadmap status update in `context/foundation/roadmap.md` during this plan. Implementation may update only this change's metadata/progress.

## Implementation Approach

Keep S-02 as a small productized account-access slice. Use the existing `/dashboard` protected route as the personal CV workspace, preserve middleware-based protection, and update auth endpoints only where the product flow requires it.

The auth POST endpoints should continue to use form POST plus redirect responses. Introduce a narrow safe-error mapping helper or local mapping pattern for auth routes rather than exposing raw provider messages in query strings. The UI work should keep the current React form components and lightly restyle the containing Astro pages to match the product landing's restrained slate/emerald visual language.

## Critical Implementation Details

### Signup session branching

Supabase signup behavior depends on email confirmation settings. The signup route should inspect the signup response: if an active session is present, redirect to `/dashboard`; otherwise redirect to `/auth/confirm-email`. This keeps local auto-confirm and production confirmation flows compatible without changing the auth provider setup.

### Disabled Start CV action

The workspace "Start CV" action is intentionally visible but not navigable in S-02. It should communicate that the questionnaire comes next and must not create `/questionnaire`, `/cv/new`, mock answer state, or any persistence placeholder.

## Phase 1: Auth Redirects And Safe Errors

### Overview

This phase fixes the account-access flow at the server route level while preserving the current Supabase SSR client architecture and form POST conventions.

### Changes Required:

#### 1. Signin Endpoint Redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Make successful signin complete the S-02 account-access path by sending the user directly to the protected CV workspace.

**Contract**: Keep the route as an uppercase `POST` `APIRoute`, keep `createClient(context.request.headers, context.cookies)`, keep form POST input, and change successful signin redirect from `/` to `/dashboard`.

#### 2. Signup Endpoint Session-Aware Redirect

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Support both local auto-confirmed signup and production email-confirmation signup without changing Supabase project settings.

**Contract**: Keep the route as an uppercase `POST` `APIRoute`, keep `createClient(context.request.headers, context.cookies)`, and inspect the `signUp` response. Redirect to `/dashboard` when signup returns an active session; otherwise redirect to `/auth/confirm-email`.

#### 3. Safe Auth Error Mapping

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Replace raw provider/server error text in user-facing query strings with safe friendly messages.

**Contract**: Map missing Supabase configuration and signin failures into small user-facing buckets. Do not expose Supabase secret names, provider internals, stack traces, or raw error details in the redirect URL.

#### 4. Safe Signup Error Mapping

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Apply the same safe user-facing error boundary to signup failures.

**Contract**: Map missing Supabase configuration and signup failures into safe messages suitable for `ServerError`. Preserve the existing `?error=` display contract so the React form components do not need a deep redesign.

### Success Criteria:

#### Automated Verification:

- Signin endpoint keeps the existing Supabase SSR helper path and redirects successful signin to `/dashboard`.
- Signup endpoint branches to `/dashboard` when the signup response includes an active session and to `/auth/confirm-email` otherwise.
- Auth endpoints do not redirect raw `error.message` values into user-facing query strings.
- Lint passes: `npm run lint`.

#### Manual Verification:

- Signing in with valid credentials lands on `/dashboard`.
- Signing in with invalid credentials shows a friendly error message on `/auth/signin`.
- Signing up in a local auto-confirm environment lands on `/dashboard`.
- Signing up in an email-confirmation environment still lands on `/auth/confirm-email`.

**Implementation Note**: After this phase, pause for manual confirmation that signin and signup redirects behave correctly in the available local Supabase configuration.

---

## Phase 2: Product Auth Pages

### Overview

This phase lightly restyles the signin, signup, and confirm-email pages so account access feels like part of AI CV Builder while keeping the existing form components and validation behavior.

### Changes Required:

#### 1. Signin Page Product Framing

**File**: `src/pages/auth/signin.astro`

**Intent**: Replace starter-style auth framing with AI CV Builder account-access framing.

**Contract**: Keep rendering `SignInForm` with `client:load` and `serverError={error}`. Update surrounding copy/layout classes to match the product landing direction without rewriting the React form component.

#### 2. Signup Page Product Framing

**File**: `src/pages/auth/signup.astro`

**Intent**: Make account creation feel like the start of CV work rather than a generic starter signup screen.

**Contract**: Keep rendering `SignUpForm` with `client:load` and `serverError={error}`. Update the page wrapper, heading, support copy, and signin link styling only as needed for product consistency.

#### 3. Confirm Email Page Product Framing

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Keep confirmation messaging clear while aligning visual treatment with the rest of the product access flow.

**Contract**: Preserve the current dev/prod copy branch, but restyle and reword only within the confirm-email page. Do not add email resend, callback handling, or account management features.

#### 4. Existing Auth Form Components

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Preserve the existing interactive signin validation surface.

**Contract**: Do not redesign or replace the component. Only make small styling/copy adjustments if required by the new page container.

#### 5. Existing Signup Form Component

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Preserve the existing interactive signup validation surface, including email validation, password length, and password confirmation.

**Contract**: Do not redesign or replace the component. Only make small styling/copy adjustments if required by the new page container.

### Success Criteria:

#### Automated Verification:

- Auth pages still render the existing React form components with `client:load`.
- No new auth provider, password reset, OAuth, or account-management route is added.
- Lint passes: `npm run lint`.

#### Manual Verification:

- `/auth/signin` reads as AI CV Builder account access, not starter-template auth.
- `/auth/signup` reads as starting CV work, not a generic starter signup.
- `/auth/confirm-email` remains understandable in both local-dev and production confirmation copy paths.
- Auth page layouts remain readable and non-overlapping on mobile and desktop widths.

**Implementation Note**: After this phase, pause for manual visual confirmation that the light restyle is enough and has not turned into a full auth redesign.

---

## Phase 3: CV Workspace Shell

### Overview

This phase replaces the current starter dashboard with the protected personal CV workspace shell needed to unblock S-03 and S-06 planning.

### Changes Required:

#### 1. Dashboard As Personal CV Workspace

**File**: `src/pages/dashboard.astro`

**Intent**: Turn the protected dashboard into a CV workspace entry point while preserving `/dashboard` as the route.

**Contract**: Keep using `Astro.locals.user` for account context and keep signout available through `/api/auth/signout`. Replace starter dashboard copy with a product empty state for the authenticated user's personal CV workspace.

#### 2. Disabled Start CV Action

**File**: `src/pages/dashboard.astro`

**Intent**: Show the intended next step without creating questionnaire behavior before S-03.

**Contract**: Render a visible primary "Start CV" action in a disabled or non-navigating coming-next state. It must not link to a new route, create a placeholder route, or persist anything.

#### 3. Workspace Boundary Copy

**File**: `src/pages/dashboard.astro`

**Intent**: Make the empty workspace useful for downstream slices without promising unavailable features.

**Contract**: Copy may mention that guided questionnaire and saved CVs are coming next, but it must not imply generation, saving, reopening, or PDF export already work.

#### 4. Landing Workspace Labels

**File**: `src/lib/landing-content.ts`

**Intent**: Align existing landing navigation labels with the S-02 workspace framing.

**Contract**: Update labels such as "Dashboard" or "View dashboard" to workspace language where they point to `/dashboard`. Keep the existing landing content structure and do not implement full i18n.

#### 5. Protected Route Boundary

**File**: `src/middleware.ts`

**Intent**: Preserve centralized auth protection for the workspace.

**Contract**: Keep `/dashboard` in `PROTECTED_ROUTES`. Do not duplicate guards in `src/pages/dashboard.astro`. Do not add new protected routes unless implementation creates a route inside this plan, which it should not.

### Success Criteria:

#### Automated Verification:

- `/dashboard` remains listed in `PROTECTED_ROUTES`.
- Dashboard source contains no starter-only protected-page copy such as "This page is only for authenticated users."
- No questionnaire route or saved-CV route is added in this phase.
- Lint passes: `npm run lint`.

#### Manual Verification:

- Visiting `/dashboard` while signed out redirects to `/auth/signin`.
- Visiting `/dashboard` while signed in shows the personal CV workspace shell.
- The visible "Start CV" action is disabled or clearly coming-next and does not navigate.
- Signout remains available from the workspace and returns the user to `/`.
- Landing signed-in navigation points to `/dashboard` with workspace language.

**Implementation Note**: After this phase, pause for manual confirmation that `/dashboard` feels like a CV workspace entry point but does not imply S-03 or S-06 features are implemented.

---

## Phase 4: Verification And Change Metadata

### Overview

This phase runs the repo verification gates and updates only this change's metadata/progress. It deliberately does not mark the roadmap done or change external tracker state.

### Changes Required:

#### 1. Astro Type Sync

**File**: `.astro/`

**Intent**: Regenerate Astro types if required by the implemented route/component changes.

**Contract**: Run `npx astro sync`. Treat generated type updates as verification output, not a product-scope expansion.

#### 2. Repository Gates

**File**: `package.json`

**Intent**: Verify the S-02 changes against the repo's current gates.

**Contract**: Run `npm run lint` and `npm run build`. Do not introduce a new test runner or test script.

#### 3. Manual Account-Access Smoke Test

**File**: `context/changes/account-access-for-cv-work/plan.md`

**Intent**: Verify the full account-access flow from signed-out visitor to protected workspace in the available local environment.

**Contract**: Manually test signed-out `/dashboard`, signin success, signup success branch available locally, auth error display, workspace disabled action, and signout.

#### 4. Change Metadata And Progress Only

**File**: `context/changes/account-access-for-cv-work/change.md`

**Intent**: Keep this change's state accurate without prematurely updating roadmap status.

**Contract**: During implementation, update this change's `change.md` and `plan.md` progress according to the 10x progress convention. Do not mark `context/foundation/roadmap.md` done in S-02 implementation.

### Success Criteria:

#### Automated Verification:

- Astro types sync successfully: `npx astro sync`.
- Lint passes: `npm run lint`.
- Production build passes: `npm run build`.
- Source search confirms no new questionnaire or saved-CV route was added for S-02.

#### Manual Verification:

- Signed-out users can start from `/`, reach signup/signin, and cannot access `/dashboard`.
- Signed-in users land on `/dashboard` after signin and see the CV workspace shell.
- Signup behaves correctly for the available Supabase confirmation setting.
- Friendly auth errors appear without exposing raw provider details.
- `context/foundation/roadmap.md` remains unchanged by this S-02 implementation.

**Implementation Note**: After this phase, pause for manual confirmation before treating S-02 as implemented or syncing roadmap/tracker status in a separate action.

---

## Testing Strategy

### Unit Tests:

- No unit test runner exists in this repo yet, and S-02 does not introduce one.

### Integration Tests:

- Use current repository gates: `npx astro sync`, `npm run lint`, and `npm run build`.
- Use source search to confirm S-02 did not add questionnaire or saved-CV routes.
- Use source search to confirm raw `error.message` is not redirected into auth query strings.

### Manual Testing Steps:

1. Open `/` signed out and confirm start/signin links lead to account access.
2. Visit `/dashboard` signed out and confirm middleware redirects to `/auth/signin`.
3. Sign in with valid credentials and confirm the response lands on `/dashboard`.
4. Sign in with invalid credentials and confirm the signin page shows a friendly message.
5. Sign up in the available local Supabase configuration and confirm the session-aware branch behaves as expected.
6. Open `/dashboard` signed in and confirm it presents a personal CV workspace shell.
7. Confirm the "Start CV" action is visible but disabled or clearly coming-next.
8. Sign out from the workspace and confirm the user returns to `/`.
9. Confirm no questionnaire, saved-CV library, persistence, generation, or export behavior appears in S-02.

## Performance Considerations

S-02 should add no client-side state beyond the existing auth form islands. The workspace shell should remain Astro-rendered static markup using `Astro.locals.user`; avoid fetching saved CV data, adding client stores, or adding polling/caching behavior before S-06.

## Migration Notes

No database migration is required. No Supabase Auth architecture migration is required. Local Supabase currently has email confirmations disabled, while production may require confirmation; session-aware signup branching is the compatibility boundary for both settings.

## References

- Roadmap S-02 outcome: `context/foundation/roadmap.md:108`.
- PRD FR-003 email/password auth: `context/foundation/prd.md:60`.
- PRD flat user model: `context/foundation/prd.md:109`.
- Supabase SSR helper: `src/lib/supabase.ts:5`.
- Protected route boundary: `src/middleware.ts:4`.
- Signin endpoint current redirect: `src/pages/api/auth/signin.ts:19`.
- Signup endpoint current redirect: `src/pages/api/auth/signup.ts:19`.
- Current dashboard placeholder: `src/pages/dashboard.astro:7`.
- Local email confirmation setting: `supabase/config.toml:202`.
- F-02 out-of-scope persistence boundary: `context/changes/cv-persistence-privacy-contract/persistence-privacy-contract.md:234`.
- Context7 documentation check: `/supabase/ssr` for per-request server client and cookie handling; `/supabase/supabase` for email/password signup with optional email redirect and confirmation behavior.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Auth Redirects And Safe Errors

#### Automated

- [x] 1.1 Signin endpoint keeps the existing Supabase SSR helper path and redirects successful signin to `/dashboard` — 9db08ed
- [x] 1.2 Signup endpoint branches to `/dashboard` when the signup response includes an active session and to `/auth/confirm-email` otherwise — 9db08ed
- [x] 1.3 Auth endpoints do not redirect raw `error.message` values into user-facing query strings — 9db08ed
- [x] 1.4 Lint passes: `npm run lint` — 9db08ed

#### Manual

- [x] 1.5 Signing in with valid credentials lands on `/dashboard` — 9db08ed
- [x] 1.6 Signing in with invalid credentials shows a friendly error message on `/auth/signin` — 9db08ed
- [x] 1.7 Signing up in a local auto-confirm environment lands on `/dashboard` — 9db08ed
- [x] 1.8 Signing up in an email-confirmation environment still lands on `/auth/confirm-email` — 9db08ed

### Phase 2: Product Auth Pages

#### Automated

- [x] 2.1 Auth pages still render the existing React form components with `client:load` — 94c570f
- [x] 2.2 No new auth provider, password reset, OAuth, or account-management route is added — 94c570f
- [x] 2.3 Lint passes: `npm run lint` — 94c570f

#### Manual

- [ ] 2.4 `/auth/signin` reads as AI CV Builder account access, not starter-template auth
- [ ] 2.5 `/auth/signup` reads as starting CV work, not a generic starter signup
- [ ] 2.6 `/auth/confirm-email` remains understandable in both local-dev and production confirmation copy paths
- [ ] 2.7 Auth page layouts remain readable and non-overlapping on mobile and desktop widths

### Phase 3: CV Workspace Shell

#### Automated

- [ ] 3.1 `/dashboard` remains listed in `PROTECTED_ROUTES`
- [ ] 3.2 Dashboard source contains no starter-only protected-page copy such as "This page is only for authenticated users."
- [ ] 3.3 No questionnaire route or saved-CV route is added in this phase
- [ ] 3.4 Lint passes: `npm run lint`

#### Manual

- [ ] 3.5 Visiting `/dashboard` while signed out redirects to `/auth/signin`
- [ ] 3.6 Visiting `/dashboard` while signed in shows the personal CV workspace shell
- [ ] 3.7 The visible "Start CV" action is disabled or clearly coming-next and does not navigate
- [ ] 3.8 Signout remains available from the workspace and returns the user to `/`
- [ ] 3.9 Landing signed-in navigation points to `/dashboard` with workspace language

### Phase 4: Verification And Change Metadata

#### Automated

- [ ] 4.1 Astro types sync successfully: `npx astro sync`
- [ ] 4.2 Lint passes: `npm run lint`
- [ ] 4.3 Production build passes: `npm run build`
- [ ] 4.4 Source search confirms no new questionnaire or saved-CV route was added for S-02

#### Manual

- [ ] 4.5 Signed-out users can start from `/`, reach signup/signin, and cannot access `/dashboard`
- [ ] 4.6 Signed-in users land on `/dashboard` after signin and see the CV workspace shell
- [ ] 4.7 Signup behaves correctly for the available Supabase confirmation setting
- [ ] 4.8 Friendly auth errors appear without exposing raw provider details
- [ ] 4.9 `context/foundation/roadmap.md` remains unchanged by this S-02 implementation
