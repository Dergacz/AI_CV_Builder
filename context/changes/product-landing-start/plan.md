# Product Landing Start Implementation Plan

## Overview

Replace the starter homepage with the first AI CV Builder product landing page. The page must explain that the product turns the user's own answers into a structured professional CV, give visitors a clear start path, and keep the implementation small enough to unblock S-02 and S-03 without pulling in questionnaire, generation, persistence, or full i18n work.

## Current State Analysis

The app has an Astro SSR homepage, auth routes, a protected dashboard, Tailwind styling, and Cloudflare build wiring. The current homepage is still the starter experience: `/` imports `Welcome`, `Welcome.astro` says "10x Astro Starter", and the landing sections describe auth, stack, and developer experience rather than the CV product.

The product requirement is narrow. FR-001 requires a visitor to understand the landing page value proposition, and FR-002 requires a visitor to start CV creation from the landing page. The roadmap marks S-01 as ready with no prerequisites, blockers, or unknowns.

## Desired End State

The root route renders an AI CV Builder landing page whose first viewport makes the product identity and value clear. The primary start action sends unauthenticated visitors to `/auth/signup` and signed-in users to `/dashboard`, using existing auth routes instead of adding a placeholder start route.

Landing copy is not embedded as scattered English string literals inside the page markup. It is shaped through a small typed content contract so the future lightweight EN/PL/RU i18n layer can add localized entries and a selector without restructuring the landing component.

### Key Discoveries:

- The root route currently delegates all homepage UI to `Welcome`: `src/pages/index.astro:2`.
- `Welcome.astro` is starter-specific, including "10x Astro Starter" hero copy and developer-tool cards: `src/components/Welcome.astro:35`.
- `Topbar.astro` already reads `Astro.locals.user` and can branch signed-in vs signed-out actions: `src/components/Topbar.astro:2`.
- Route protection is centralized through `PROTECTED_ROUTES`, currently only `"/dashboard"`: `src/middleware.ts:4`.
- The PRD explicitly warns that landing copy should avoid "magic AI" messaging and explain transformation from user answers: `context/foundation/prd.md:56`.
- The roadmap defines S-01 as "user can understand the value proposition and start CV creation" with no prerequisites: `context/foundation/roadmap.md:96`.

## What We're NOT Doing

- No questionnaire UI, questionnaire route, or answer state.
- No AI generation, mock generation, loading state, or CV draft preview backed by real data.
- No Supabase schema, CV persistence, saved CV library, or dashboard replacement.
- No full i18n implementation, language switcher, locale routing, cookie persistence, or translated Polish/Russian copy in this slice.
- No uploads, multiple templates, billing, document editor, job tailoring, cover letters, or other PRD non-goals.
- No new app-wide state layer or generic content framework.

## Implementation Approach

Keep S-01 as a static Astro-first slice. Replace the starter `Welcome` component with a product landing component and a tiny typed landing-content module. The component should render from the content object, choose the correct start URL from `Astro.locals.user`, and use existing routes.

The design should move away from the starter cosmic/orb treatment toward a restrained product UI. The first viewport should include the AI CV Builder name, a clear plain-language promise, a primary start action, and a visible hint of the process section. Use a lightweight product-preview visual built from HTML/CSS to show the future CV outcome without inventing a functional editor.

## Phase 1: Product Landing And Start Path

### Overview

This phase replaces the starter landing experience with the S-01 product landing, wires the start CTA to existing auth/workspace routes, and preserves a typed content boundary for later lightweight i18n.

### Changes Required:

#### 1. Landing Content Contract

**File**: `src/lib/landing-content.ts`

**Intent**: Create a small typed source for landing copy and structured sections so the page does not hardcode English strings directly in the Astro template. Keep the implementation intentionally shallow: default English content now, compatible with later `en`/`pl`/`ru` expansion.

**Contract**: Export a `landingContent` object and related types for the product hero, process steps, trust notes, CTA labels, and preview labels. The current rendered locale is `en`; the shape should make adding `pl` and `ru` entries additive later, but this phase must not implement selection or persistence.

#### 2. Product Landing Component

**File**: `src/components/ProductLanding.astro`

**Intent**: Render the new AI CV Builder landing page using the content contract, current auth state, and existing route paths. The page should make clear that the user provides simple answers and the product turns those answers into a professional CV draft.

**Contract**: Read `Astro.locals.user` to choose the primary CTA target:

- signed out: `/auth/signup`
- signed in: `/dashboard`

Render a full-width landing experience with:

- product/top navigation,
- hero with product name and value proposition,
- primary CTA and secondary sign-in/dashboard action,
- concise process section covering answer questions, receive draft, edit/export,
- small trust/scope notes that avoid "magic AI" claims,
- non-functional but realistic CV preview visual.

Do not add client JavaScript unless the final UI truly needs it; this should be Astro-rendered markup.

#### 3. Root Route Wiring

**File**: `src/pages/index.astro`

**Intent**: Point `/` at the product landing component and set product-specific metadata.

**Contract**: Replace the `Welcome` import/render with `ProductLanding`. Pass a page title through `Layout`, for example `AI CV Builder`.

#### 4. Starter Component Cleanup

**File**: `src/components/Welcome.astro`

**Intent**: Remove the unused starter homepage so the repo no longer contains a misleading active landing component.

**Contract**: Delete the file after `src/pages/index.astro` no longer imports it. If the implementer keeps a compatibility wrapper instead, it must not contain starter copy or be imported from `/`.

#### 5. Layout Metadata Default

**File**: `src/layouts/Layout.astro`

**Intent**: Stop the default document title from naming the starter.

**Contract**: Change the default `title` prop from `10x Astro Starter` to `AI CV Builder`. Do not change config banners or global layout behavior.

#### 6. Visual Styling Boundary

**File**: `src/styles/global.css`

**Intent**: Remove or stop depending on starter-only cosmic styling for the homepage if the new component no longer uses it.

**Contract**: Delete the `bg-cosmic` utility only if no remaining route uses it. If auth/dashboard pages still use it in this phase, leave it in place and keep the landing component on its own restrained Tailwind classes. Do not restyle auth pages in S-01.

### Success Criteria:

#### Automated Verification:

- Astro types sync successfully: `npx astro sync`
- Lint passes: `npm run lint`
- Production build passes: `npm run build`
- No active source references to starter homepage copy remain: `rg "10x Astro Starter|production-ready starter|Developer Experience" src`

#### Manual Verification:

- Visiting `/` as a signed-out user shows AI CV Builder product copy, not starter copy.
- The primary start CTA on `/` points to `/auth/signup` when signed out.
- The page explains "answer questions -> AI draft -> edit/export" without implying the AI invents career facts.
- The landing layout is readable and non-overlapping on mobile and desktop widths.
- If signed in, the primary start CTA points to `/dashboard`.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the landing page reads correctly, the CTA behavior is acceptable, and responsive layout looks clean.

---

## Testing Strategy

### Unit Tests:

- No unit test runner exists in this repo yet, and S-01 does not introduce one.

### Integration Tests:

- Use existing build/lint gates: `npx astro sync`, `npm run lint`, and `npm run build`.
- Use `rg` to confirm starter homepage copy is not still active in `src`.

### Manual Testing Steps:

1. Start the dev server and open `/`.
2. Verify the first viewport names AI CV Builder and states the value proposition clearly.
3. Verify signed-out primary CTA target is `/auth/signup`.
4. Sign in or use an authenticated session and verify primary CTA target is `/dashboard`.
5. Resize to a mobile viewport and a desktop viewport; confirm text, CTA buttons, and the CV preview do not overlap.
6. Confirm the page does not promise upload/import, multiple templates, a full editor, cover letters, billing, or job tailoring.

## Performance Considerations

The landing page should remain server-rendered static markup with no React island. Avoid adding image-heavy assets, animation libraries, analytics scripts, or client state in this phase.

## Migration Notes

No data migration, auth migration, or route-protection migration is required. `/dashboard` remains protected through the existing middleware, and `/auth/signup` remains the signed-out start path until later slices introduce the real CV workspace/questionnaire.

## References

- PRD landing requirements: `context/foundation/prd.md:56`
- Roadmap S-01: `context/foundation/roadmap.md:96`
- Current root route: `src/pages/index.astro:2`
- Current starter homepage component: `src/components/Welcome.astro:35`
- Current topbar auth branching: `src/components/Topbar.astro:2`
- Protected route boundary: `src/middleware.ts:4`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Product Landing And Start Path

#### Automated

- [x] 1.1 Astro types sync successfully: `npx astro sync`
- [x] 1.2 Lint passes: `npm run lint`
- [x] 1.3 Production build passes: `npm run build`
- [x] 1.4 No active source references to starter homepage copy remain: `rg "10x Astro Starter|production-ready starter|Developer Experience" src`

#### Manual

- [x] 1.5 Visiting `/` as a signed-out user shows AI CV Builder product copy, not starter copy
- [x] 1.6 The primary start CTA on `/` points to `/auth/signup` when signed out
- [x] 1.7 The page explains "answer questions -> AI draft -> edit/export" without implying the AI invents career facts
- [x] 1.8 The landing layout is readable and non-overlapping on mobile and desktop widths
- [x] 1.9 If signed in, the primary start CTA points to `/dashboard`
