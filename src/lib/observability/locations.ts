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
  // AI generation service — see GenerationErrorLocation above (S-07 p3).
  | GenerationErrorLocation
  // F-01 proof-of-life route (debug-guarded).
  | "api/observability/smoke:smoke";

/** Locations emitted from the browser. */
export type ClientErrorLocation =
  // PDF export — split by `classifyExportError`'s verdict (S-07 p4).
  | "hooks/useCvExport:assetFetch"
  | "hooks/useCvExport:render"
  // CV mutation + transport failures (S-07 p4).
  | "hooks/useCvSave:transport"
  | "hooks/useCvSave:server"
  | "components/SavedCvList:delete"
  | "components/QuestionnaireFlow:transport"
  | "components/QuestionnaireFlow:server"
  // Global browser hooks. `unhandledrejection` has no filename/lineno to synthesize from.
  | "client:unhandledrejection"
  | BrowserRuntimeErrorLocation;

export type ErrorLocation = ServerErrorLocation | ClientErrorLocation;
