# Permanent Account Deletion (S-08) — Plan Brief

> Full plan: `context/changes/account-deletion/plan.md`

## What & Why

A signed-in user has no way to leave. FR-011 / US-03 require that they can permanently delete their
account and all associated data — profile, CVs, questionnaire answers, sign-in identity, and
identifying analytics data — behind an explicit, deliberate confirmation, with no recoverable copy
retained. This is the last remaining Wave A slice; every other slice in the roadmap is `done`, and
launching without it means shipping a product with no erasure path.

## Starting Point

The schema already models erasure: all four user-scoped tables (`cvs`, `subscriptions`, `feedback`,
`generation_usage`) declare `user_id ... references auth.users (id) on delete cascade`, and the
consent stamp lives in `auth.users` metadata rather than its own table. Deleting that one row *is*
the erasure. What is missing is the privilege to delete it — the app builds only an anon-key SSR
client, a limitation the `generation_usage` migration states outright — and any place to put the
control: `/dashboard` is the only signed-in page and has no account settings.

## Desired End State

A user opens `/account`, reads a danger zone that lists exactly what will be removed, clicks delete,
types their own email address into a modal, and confirms. They land on the public landing page with
a "your account and data have been permanently deleted" notice, and can no longer sign in. Nothing
of theirs remains in any store the product controls.

## Key Decisions Made

| Decision                | Choice                                              | Why (1 sentence)                                                                                              | Source |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| Privileged delete path  | Supabase admin API with a dedicated secret key       | The supported path that stays compatible with future Auth internals and cleans up sessions/refresh tokens.     | Plan   |
| Secret-key blast radius | One module reads the key, fenced by ESLint           | Isolation is structural rather than conventional, so the key's reach cannot quietly widen later.               | Plan   |
| Identity source         | Session-verified `userId` only, never request input  | The difference between a deletion endpoint and an account-deletion vulnerability.                              | Plan   |
| Analytics erasure       | Rely on key destruction, document it, stop emits     | Person profiles are off and the pseudonym's only input is the user id, so deletion destroys the only linkage.  | Plan   |
| Confirmation strength   | Type the account email                               | Deliberate, works for Google-only accounts, and locale-neutral — no translated magic word.                     | Plan   |
| Surface location        | New `/account` page                                  | Keeps an irreversible control off the busiest signed-in page and gives the product a settings home.            | Plan   |
| Failure posture         | Admin delete is the commit point; teardown best-effort | After a successful erasure an error screen would tell the user the opposite of the truth.                    | Plan   |
| Client teardown         | Auth cookies + `obs_session` + `obs_confirmed`        | Ends the deleted user's analytics session; `ui_locale` is a device preference, not personal data.              | Plan   |
| Missing secret          | Route 503s, page shows "unavailable"                 | Fails closed and honest — a prod misconfiguration stays visible instead of silently removing a legal surface.  | Plan   |
| Telemetry               | Failure reports only, no success event               | A broken erasure path is our defect and must be visible; a new identified event would contradict the erasure.  | Plan   |
| Verification            | Contract tests + non-destructive E2E + pgTAP cascade | Proves the logic and the schema contract without letting an irreversible action into a shared-user suite.      | Plan   |

## Scope

**In scope:** `SUPABASE_SECRET_KEY` env entry; isolated admin module + ESLint fence; account-deletion
service; `POST /api/account/delete`; `/account` page + confirmation island; dashboard nav link;
`/?deleted=1` notice; trilingual copy; pgTAP cascade test; non-destructive Playwright spec; README /
`CLAUDE.md` / privacy-policy documentation.

**Out of scope:** soft delete or grace period; data export; PostHog deletion API calls;
operator-initiated deletion, support tooling, or a deletion audit log; a general-purpose admin
client; clearing `ui_locale`; an `account_deleted` success event; any destructive E2E spec; any
change to existing tables, the CV schema, or the `/api/cv/*` routes.

## Architecture / Approach

```
/account (protected)
   └─ DeleteAccountPanel (island)
        └─ ConfirmDialog — confirm disabled until typed email == session email
             │  POST /api/account/delete { confirmation }
             ▼
      route: safeGetUser → userId + email (never from the body)
             │  confirmationMatches(typed, sessionEmail)
             ▼
      account-deletion service (injected deps, fully unit-testable)
             │
             ▼
      supabase-admin.ts  ← the ONLY importer of SUPABASE_SECRET_KEY (ESLint-fenced)
             │  auth.admin.deleteUser(userId)      ◄── commit point
             ▼
      Postgres cascade: cvs · subscriptions · feedback · generation_usage
             │
             ▼
      best-effort teardown: signOut + clear obs_session / obs_confirmed
             │  (failures reported, never surfaced)
             ▼
      200 { redirectTo: "/?deleted=1" } → island navigates
```

Everything before the admin call may abort with an error; everything after it is best-effort,
because the data is already gone.

## Phases at a Glance

| Phase                              | What it delivers                                                    | Key risk                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Privileged deletion path        | Env key, isolated admin module + fence, API route, contract tests    | The secret key bypasses RLS — isolation must be structural, and identity must never come from the request |
| 2. `/account` page + confirmation  | Protected page, confirmation island, nav link, notice, en/pl/ru copy | The gate is the only thing between a user and irreversible loss; it must not be bypassable or unclear |
| 3. Erasure proof + docs            | pgTAP cascade test, non-destructive E2E spec, README + privacy text  | The analytics-erasure claim is an argument, not a delete call — if it isn't written down it isn't defensible |

**Prerequisites:** F-01 (done — the analytics identity model this erases against); local Supabase
running for the DB and E2E suites; a Supabase secret key available locally (`npx supabase status`)
and, before release, set as a Cloudflare Worker secret.

**Estimated effort:** ~2–3 sessions across 3 phases. Phase 1 is the bulk of the logic; Phase 2 is
mostly copy across three locales; Phase 3 introduces one new toolchain (pgTAP).

## Open Risks & Assumptions

- **The secret key is the highest-privilege value in the project.** It bypasses every RLS policy.
  The ESLint fence and the single-function module bound the risk, but a leak is a full-database
  incident — hence a dedicated, rotatable key rather than reusing anything existing.
- **pgTAP is a new toolchain for this repo** and CI has no Postgres, so `npm run test:db` stays a
  local, opt-in suite. A contributor who never runs it could remove a cascade without CI noticing.
- **The analytics-erasure claim rests on reasoning, not on a delete call.** It is sound given
  `$process_person_profile: false` and the HMAC pseudonym, but it is only defensible while the
  privacy policy states it and the person-profile setting stays off.
- **Deleting `auth.users` also deletes the consent record**, which the PRD elsewhere wants
  retrievable. The erasure rule wins for deleted accounts; worth a conscious nod if a compliance
  review ever asks for retained proof-of-consent.
- **`SUPABASE_SECRET_KEY` missing in production** degrades gracefully but leaves a legally required
  surface unavailable — treat it as a release blocker, not an optional extra.
- Real end-to-end deletion is never exercised automatically; it lives in the manual checklist.

## Success Criteria (Summary)

- A user can permanently delete their account in under a minute, from a control they can find, and
  cannot trigger it by an incidental click.
- After deletion they cannot sign in, and no row referencing them survives in any app table.
- A misconfigured deployment tells the user the feature is unavailable instead of failing silently
  or appearing to work.
