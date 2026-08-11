/**
 * S-07: the closed set of `error_location` values this product can emit.
 *
 * `error_location` is the only field that says *where* something broke — the scrubber
 * (`./scrub.ts`) guarantees message and stack never leave, so a wrong location means a
 * report that cannot be acted on. Typing it as a union rather than `string` turns a typo
 * into a compile error instead of a second bucket in PostHog that nobody notices for months.
 *
 * Convention: `<module path>:<operation>`, following the two locations F-01 already put in
 * production (`api/cv/generate:checkGenerationQuota`). Adding a report site means adding its
 * location here first.
 */

/**
 * Locations synthesized at runtime by the global browser error hook, which builds
 * `${filename}:${lineno}` from an `ErrorEvent` (see `installBrowserErrorHandlers`). Unbounded by
 * nature, so it cannot be enumerated — but the trailing `${number}` keeps it strictly narrower
 * than `string`, so a hand-written `module:operation` typo still fails to type-check.
 */
export type BrowserRuntimeErrorLocation = `${string}:${number}`;

/**
 * AI generation failure modes. Named separately so `cv-generation.ts` can type its injected
 * reporter without importing the whole server union — the service stays free of any
 * observability dependency, and these seven stay distinguishable in the monitor. A collapsed
 * bucket cannot tell "the provider is down" from "the model returned unparseable output".
 */
export type GenerationErrorLocation =
  | "services/cv-generation:providerFetch"
  | "services/cv-generation:providerResponse"
  | "services/cv-generation:responseParse"
  | "services/cv-generation:modelRefusal"
  | "services/cv-generation:emptyContent"
  | "services/cv-generation:contentParse"
  | "services/cv-generation:schemaMismatch";

/** Locations emitted from the server (Astro routes, middleware, services). */
export type ServerErrorLocation =
  // Catch-all for anything thrown out of a route or downstream middleware (S-07 p2).
  | "middleware:unhandled"
  // Generation route — the two F-01 fail-open paths already in production.
  | "api/cv/generate:checkGenerationQuota"
  | "api/cv/generate:recordGeneration"
  // SSR page loads. These call the repository DIRECTLY, bypassing the API routes below — and since
  // the library and reopen views are server-rendered, they are the paths users actually hit. Added
  // in review: the plan surveyed `src/pages/api/**` only and missed them.
  | "pages/dashboard:listCvs"
  | "pages/cv/[id]:getCv"
  // CV persistence routes (S-07 p2).
  | "api/cv/index:load"
  | "api/cv/index:save"
  | "api/cv/[id]:load"
  | "api/cv/[id]:save"
  | "api/cv/[id]:delete"
  | "api/cv/feedback:store"
  // Pre-F-01 console.warn breadcrumbs, promoted to real reports (S-07 p2).
  | "api/auth/signout:signout"
  | "lib/supabase:safeGetUser"
  // Account deletion (S-08). Failures ONLY — no success event: writing a fresh event under the
  // user's pseudonym at the moment we claim to erase their identity would contradict the erasure.
  // The two stages sit either side of the commit point and mean very different things: `delete`
  // is a broken erasure path (nothing was removed), `teardown` is stale client state after a
  // successful erasure (the account IS gone). Collapsing them would hide which one happened.
  | "api/account/delete:delete"
  | "api/account/delete:teardown"
  // AI generation service — see GenerationErrorLocation above (S-07 p3).
  | GenerationErrorLocation
  // F-01 proof-of-life route (debug-guarded).
  | "api/observability/smoke:smoke";

/** Locations emitted from the browser. */
export type ClientErrorLocation =
  // PDF export — split by `classifyExportError`'s verdict (S-07 p4).
  | "hooks/useCvExport:assetFetch"
  | "hooks/useCvExport:render"
  // CV mutation + transport failures (S-07 p4). Transport ONLY — a non-ok response is already
  // reported server-side with a precise location (p2/p3), so reporting it here as well would
  // double-count every server-side failure and make the rates unusable.
  | "hooks/useCvSave:transport"
  | "components/SavedCvList:delete"
  | "components/QuestionnaireFlow:transport"
  // Last-resort guard so an unexpected throw while applying a response cannot strand the
  // questionnaire in "loading" with no error and no retry (added in review).
  | "components/QuestionnaireFlow:postResponse"
  // Account-deletion island (S-08). Transport failures only, per the rule above — every non-ok
  // response from the delete route is already reported server-side with a precise location.
  | "client:account-delete"
  // Global browser hooks. `unhandledrejection` has no filename/lineno to synthesize from.
  | "client:unhandledrejection"
  | BrowserRuntimeErrorLocation;

export type ErrorLocation = ServerErrorLocation | ClientErrorLocation;
