import { POSTHOG_API_KEY, POSTHOG_HOST } from "astro:env/server";

import { scrub, type SafeProps, type TrackProps } from "./scrub";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";
const POSTHOG_CAPTURE_PATH = "/i/v0/e/";
const OBSERVABILITY_TIMEOUT_MS = 1_500;
const ERROR_EVENT = "observability_error";

export type ObservabilityEvent = "observability_smoke" | typeof ERROR_EVENT;

export interface Identity {
  distinctId: string | null;
}

export interface ErrorContext extends TrackProps {
  error_location: string;
}

interface PostHogPayload {
  api_key: string;
  event: ObservabilityEvent;
  distinct_id: string;
  properties: SafeProps & { $process_person_profile: false };
}

function getCaptureUrl(): string {
  const configuredHost = POSTHOG_HOST?.trim();
  const host = configuredHost === undefined || configuredHost.length === 0 ? DEFAULT_POSTHOG_HOST : configuredHost;
  return `${host.replace(/\/$/, "")}${POSTHOG_CAPTURE_PATH}`;
}

function errorType(error: unknown): string {
  if (error instanceof Error && error.name.trim()) {
    return error.name;
  }
  return "Error";
}

async function emit(payload: PostHogPayload): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, OBSERVABILITY_TIMEOUT_MS);

  try {
    await fetch(getCaptureUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Observability must never throw into the user-facing request path.
  } finally {
    clearTimeout(timeout);
  }
}

export async function track(event: ObservabilityEvent, props: TrackProps = {}, identity?: Identity): Promise<void> {
  const apiKey = POSTHOG_API_KEY?.trim();
  const distinctId = identity?.distinctId?.trim();
  if (!apiKey || !distinctId) {
    return;
  }

  await emit({
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: {
      ...scrub(props),
      $process_person_profile: false,
    },
  });
}

export async function reportError(error: unknown, context: ErrorContext, identity?: Identity): Promise<void> {
  await track(
    ERROR_EVENT,
    {
      ...context,
      error_type: errorType(error),
    },
    identity,
  );
}
