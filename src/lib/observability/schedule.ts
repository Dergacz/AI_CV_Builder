import type { ErrorContext, Identity } from "./index";
import { reportError } from "./index";

/**
 * S-07: the one way server code emits observability without blocking the response.
 *
 * `track`/`reportError` time-box their PostHog round-trip at 1.5s (`OBSERVABILITY_TIMEOUT_MS`).
 * With F-01 that cost sat on a single route; S-07 puts a report on roughly fifteen failure paths,
 * so awaiting would mean a PostHog slowdown during an incident measurably worsening our own
 * outage. Instead the emit is handed to Cloudflare's `waitUntil` when the Worker runtime provides
 * it — which keeps the request alive until the emit finishes — and otherwise left to run detached.
 *
 * The `locals.cfContext` key is the Astro 6 spelling; `locals.runtime.ctx` was removed. See
 * `src/middleware.test.ts` for the regression test that pins this.
 */

interface WaitUntilContext {
  waitUntil?(promise: Promise<unknown>): void;
}

/** Structural subset of `App.Locals` the scheduler needs. Accepts the real `Astro.locals`. */
export interface SchedulableLocals {
  observability?: Identity;
  cfContext?: WaitUntilContext;
}

/**
 * Hand a fire-and-forget emit to the runtime. The `.catch` is not optional: a detached promise
 * that rejects becomes an unhandled rejection, and observability must never be the thing that
 * takes down a request.
 *
 * In dev/node there is no `waitUntil`, so the emit races the process — acceptable for a
 * best-effort signal, and the reason manual verification checks latency rather than delivery.
 */
export function scheduleEmit(emit: Promise<unknown>, locals?: SchedulableLocals): void {
  // `Promise.resolve` is a no-op on a real emit (it returns the same promise) and is here so a
  // call site whose emit is stubbed out — every route test mocks `@/lib/observability` — degrades
  // to a no-op instead of throwing on `undefined.catch`. Observability must never be able to break
  // the path it observes, and that includes under test.
  const guarded = Promise.resolve(emit).catch(() => undefined);
  const cfContext = locals?.cfContext;
  if (cfContext?.waitUntil) {
    cfContext.waitUntil(guarded);
  }
}

/**
 * Report an error off the response path, using the request's already-resolved pseudonymous
 * identity. This is what route and service call sites use — it exists so no call site has to
 * remember to detach.
 */
export function scheduleErrorReport(error: unknown, context: ErrorContext, locals?: SchedulableLocals): void {
  scheduleEmit(reportError(error, context, locals?.observability), locals);
}
