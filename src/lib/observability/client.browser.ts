import posthog from "posthog-js";
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from "astro:env/client";

import type { FunnelEvent } from "./events";
import { scrub, type TrackProps } from "./scrub";

// Browser-side mirror of the server recording contract in ./index.ts. Kept self-contained
// (no ./index import) so the client bundle never pulls in `astro:env/server`. The event names
// and the `$process_person_profile: false` guard are intentionally identical to the server side.
const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";
const ERROR_EVENT = "observability_error";

export type ClientObservabilityEvent = "observability_smoke" | typeof ERROR_EVENT | FunnelEvent;

export interface ClientErrorContext extends TrackProps {
  error_location: string;
}

interface InitOptions {
  key?: string;
  host?: string;
  installErrorHandlers?: boolean;
  distinctId?: string;
}

interface BrowserErrorEvent {
  error?: unknown;
  filename?: string;
  lineno?: number;
}

interface BrowserRejectionEvent {
  reason?: unknown;
}

interface ListenerTarget {
  addEventListener(type: string, listener: (event: unknown) => void): void;
}

let initialized = false;
let handlersInstalled = false;

function errorType(error: unknown): string {
  if (error instanceof Error && error.name.trim()) {
    return error.name;
  }
  return "Error";
}

function captureClient(event: ClientObservabilityEvent, props: TrackProps): void {
  if (!initialized) {
    return;
  }
  posthog.capture(event, {
    ...scrub(props),
    $process_person_profile: false,
  });
}

/**
 * Initialize PostHog in the browser in cookieless (memory persistence) mode. Returns true when
 * PostHog was initialized, false when no public key is configured (safe no-op). No funnel events
 * are emitted here — this only bootstraps the SDK so S-01/S-07 can plug in later.
 */
export function initClientObservability(options: InitOptions = {}): boolean {
  // Idempotent: the landing page inits from its own script (to emit funnel_landing_viewed) and so
  // does the root layout; whichever runs first wins, the second is a no-op. Avoids a double init.
  if (initialized) {
    return true;
  }

  const key = options.key ?? PUBLIC_POSTHOG_KEY;
  if (!key) {
    return false;
  }

  const host = options.host ?? PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST;
  posthog.init(key, {
    api_host: host || DEFAULT_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: "memory",
    // Pin the browser SDK's distinct_id to the server-resolved id so client funnel events line up
    // with server ones into a single funnel. $process_person_profile:false (per capture) keeps
    // person profiles off, so bootstrapping the id does not reverse F-01's cookieless posture.
    ...(options.distinctId ? { bootstrap: { distinctID: options.distinctId } } : {}),
  });
  initialized = true;

  if (options.installErrorHandlers !== false) {
    installBrowserErrorHandlers();
  }
  return true;
}

/** Emit a scrubbed client event. No-op until initClientObservability has run. */
export function trackClient(event: ClientObservabilityEvent, props: TrackProps = {}): void {
  captureClient(event, props);
}

/** Report a browser error carrying only its type and location — never message or stack content. */
export function reportErrorClient(error: unknown, context: ClientErrorContext): void {
  captureClient(ERROR_EVENT, {
    ...context,
    error_type: errorType(error),
  });
}

/**
 * Attach `error` / `unhandledrejection` listeners that forward only a scrubbed type + location.
 * Idempotent: repeated calls register the listeners at most once. This is the S-07 frontend
 * surface entry point — content-free by construction.
 */
export function installBrowserErrorHandlers(target: ListenerTarget = window): void {
  if (handlersInstalled) {
    return;
  }
  handlersInstalled = true;

  target.addEventListener("error", (event) => {
    const { error, filename, lineno } = event as BrowserErrorEvent;
    reportErrorClient(error, { error_location: `${filename ?? "unknown"}:${lineno ?? 0}` });
  });

  target.addEventListener("unhandledrejection", (event) => {
    const { reason } = event as BrowserRejectionEvent;
    reportErrorClient(reason, { error_location: "unhandledrejection" });
  });
}

interface SmokeTarget {
  __obsSmoke?: () => void;
  dispatchEvent(event: Event): boolean;
}

/**
 * F-01 proof-of-life client smoke trigger. DEV-ONLY: guarded by `import.meta.env.DEV`, so it is
 * stripped from production bundles and never wired into user-facing UI. When present, call
 * `window.__obsSmoke()` from devtools to emit one client `observability_smoke` event and dispatch a
 * test `error` event that routes through the Phase 3 browser error hook into PostHog. Remove or keep
 * DEV-guarded after F-01 verification (see README "PostHog Observability Configuration").
 */
export function installClientSmokeTrigger(target: SmokeTarget = window): void {
  if (!import.meta.env.DEV) {
    return;
  }
  target.__obsSmoke = () => {
    trackClient("observability_smoke", { surface: "client" });
    target.dispatchEvent(
      new ErrorEvent("error", { error: new Error("smoke-test"), filename: "client-smoke", lineno: 0 }),
    );
  };
}
