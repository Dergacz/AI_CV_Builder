# Product Landing Start — Plan Brief

> Full plan: `context/changes/product-landing-start/plan.md`

## What & Why

Build the first AI CV Builder product landing page. S-01 exists so a visitor can understand that the app turns their own answers into a professional CV and can start the CV creation path without seeing starter-template messaging.

## Starting Point

The app has Astro SSR, Tailwind, auth routes, a protected dashboard, and deployment/build wiring. The current root page still renders a starter homepage through `Welcome.astro`, including "10x Astro Starter" copy and developer-tool feature cards.

## Desired End State

The root page presents AI CV Builder clearly, explains the simple path from answers to draft to edit/export, and routes the primary start action through existing auth/workspace paths. Landing copy is shaped through a typed content contract so future EN/PL/RU i18n can plug in without rewriting the page structure.

## Key Decisions Made

| Decision            | Choice                                                  | Why                                                                                  |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Complexity          | Low                                                     | This is a static landing replacement with no backend, schema, or persistence change. |
| Start CTA           | Signed out to `/auth/signup`, signed in to `/dashboard` | Existing routes are enough; no placeholder start route is needed.                    |
| Landing scope       | Hero, concise process, MVP trust notes                  | Satisfies FR-001/FR-002 without building a long marketing page.                      |
| Language structure  | Typed content boundary now, no full switcher            | Avoids scattered English literals while keeping full i18n for a later slice.         |
| Implementation size | One phase                                               | The code changes form one cohesive homepage slice.                                   |

## Scope

**In scope:**

- Replace active starter homepage with AI CV Builder landing.
- Wire start CTA using current auth state.
- Add typed landing content structure for future i18n.
- Update default layout title away from the starter.
- Verify responsive readability and no starter copy in active source.

**Out of scope:**

- Questionnaire, AI generation, CV editor, save/reopen, PDF export.
- Full localization, language switcher, locale routing, or translated PL/RU copy.
- Auth flow redesign, dashboard replacement, database work, or new app-wide state.

## Architecture / Approach

Create `src/lib/landing-content.ts` as the small content contract, render it from a new `src/components/ProductLanding.astro`, and wire `/` through `src/pages/index.astro`. The component stays Astro-rendered and uses `Astro.locals.user` to choose `/auth/signup` or `/dashboard`.

## Phases at a Glance

| Phase                             | What it delivers                                              | Key risk                                                                        |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Product Landing And Start Path | Product homepage, CTA routing, content contract, verification | Copy can overpromise "magic AI" or the layout can inherit starter visual noise. |

**Prerequisites:** Existing auth routes and dashboard remain available.
**Estimated effort:** One implementation session.

## Open Risks & Assumptions

- `/dashboard` is an acceptable signed-in start target until S-02 replaces the starter dashboard with a CV workspace.
- Future i18n will reuse or migrate the landing content contract rather than requiring full localization in S-01.
- No test runner exists; verification relies on lint, build, source search, and manual responsive checks.

## Success Criteria (Summary)

- `/` no longer shows starter copy and clearly presents AI CV Builder.
- Visitors can start through `/auth/signup`; signed-in users can continue through `/dashboard`.
- Landing content is structured for future EN/PL/RU support without implementing a full language switcher now.
