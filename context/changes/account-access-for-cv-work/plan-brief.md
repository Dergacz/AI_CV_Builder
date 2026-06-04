# Account Access For CV Work — Plan Brief

> Full plan: `context/changes/account-access-for-cv-work/plan.md`

## What & Why

Build S-02: users can sign up, log in, and reach the CV workspace. Auth exists already, but it still behaves like a starter app; this plan productizes the account-access path without expanding into questionnaire, persistence, generation, or export work.

## Starting Point

The app has Supabase SSR auth, signin/signup pages, auth POST routes, and `/dashboard` protected by middleware. The current dashboard is only a starter-style protected-page placeholder, signin redirects to `/`, and signup always redirects to confirm-email.

## Desired End State

Signin lands on `/dashboard`. Signup lands on `/dashboard` when Supabase returns an active session and otherwise shows confirm-email. `/dashboard` becomes a protected personal CV workspace shell with account context, signout, and a visible disabled/coming-next Start CV action.

## Key Decisions Made

| Decision            | Choice                                  | Why                                                                        |
| ------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| Workspace route     | Keep `/dashboard`, reframe as workspace | Preserves S-01 links and existing route protection with minimal MVP churn. |
| Signin destination  | Always `/dashboard`                     | Directly satisfies account access to workspace.                            |
| Signup behavior     | Session-aware redirect                  | Supports local auto-confirm and production email-confirm flows.            |
| Start CV action     | Visible but disabled/coming-next        | Shows product direction without creating S-03 routes early.                |
| Auth page scope     | Light product restyle                   | Makes auth feel integrated while keeping current form components.          |
| Error handling      | Safe friendly buckets                   | Avoids exposing provider internals in user-facing messages.                |
| Metadata/docs scope | This change only                        | Avoids marking roadmap done before implementation verification.            |

## Scope

**In scope:**

- Signin success redirect to `/dashboard`.
- Signup success branch based on active session vs email confirmation.
- Safe user-facing auth error messages.
- Light product restyle for signin, signup, and confirm-email pages.
- Protected `/dashboard` personal CV workspace shell.
- Disabled/coming-next Start CV action.
- Verification and this change's metadata/progress updates.

**Out of scope:**

- Questionnaire routes or answer capture.
- Saved CV persistence, migrations, API routes, or library UI.
- CV generation, PDF export, storage, queues, analytics, or workers.
- Auth architecture changes, OAuth, password reset, MFA, roles, sharing, teams, or account settings.
- Roadmap status updates during S-02 implementation.

## Architecture / Approach

Keep the existing Astro SSR + Supabase Auth architecture. Auth endpoints continue to use form POST redirects and `createClient(context.request.headers, context.cookies)`, middleware remains the route-protection boundary, and `/dashboard` becomes the product workspace shell rendered from server-known `Astro.locals.user`.

## Phases at a Glance

| Phase                               | What it delivers                                          | Key risk                                                     |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 1. Auth Redirects And Safe Errors   | Correct post-auth destinations and safe error copy        | Signup confirmation behavior differs by environment.         |
| 2. Product Auth Pages               | Auth pages feel like AI CV Builder without full redesign  | Restyle can drift into unnecessary component churn.          |
| 3. CV Workspace Shell               | Protected personal workspace empty state at `/dashboard`  | Copy/action could imply questionnaire or persistence exists. |
| 4. Verification And Change Metadata | Repo gates, smoke tests, and change-only progress updates | Roadmap/tracker could be marked done prematurely.            |

**Prerequisites:** Existing Supabase auth configuration and `/dashboard` route protection remain available.
**Estimated effort:** One implementation session across four small phases.

## Open Risks & Assumptions

- Local Supabase has email confirmations disabled, so production confirmation behavior may need manual review against hosted settings.
- No test runner exists; verification relies on Astro sync, lint, build, source checks, and manual auth-flow smoke tests.
- `/dashboard` remains the workspace URL for MVP despite generic route naming.

## Success Criteria (Summary)

- Users can sign in and land on the protected CV workspace at `/dashboard`.
- Signup works for both active-session and email-confirmation outcomes.
- The workspace clearly prepares the next CV step without implementing questionnaire or persistence behavior.
