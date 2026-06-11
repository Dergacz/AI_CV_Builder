const MAX_SAFE_STRING_LENGTH = 120;

export const allowedPropertyKeys = [
  "surface",
  "route",
  "status",
  "error_type",
  "error_location",
  "duration_ms",
  "model_provider",
  "locale",
  "success",
] as const;

export type SafePropertyKey = (typeof allowedPropertyKeys)[number];
export type SafePropertyValue = string | number | boolean;
export type SafeProps = Partial<Record<SafePropertyKey, SafePropertyValue>>;
export type TrackProps = Partial<Record<SafePropertyKey, unknown>> & Record<string, unknown>;

const allowedKeys = new Set<string>(allowedPropertyKeys);

function isSafeValue(value: unknown): value is SafePropertyValue {
  if (typeof value === "string") {
    return value.length <= MAX_SAFE_STRING_LENGTH;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return typeof value === "boolean";
}

export function scrub(props: Record<string, unknown> = {}): SafeProps {
  const safe: SafeProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (!allowedKeys.has(key) || !isSafeValue(value)) {
      continue;
    }
    safe[key as SafePropertyKey] = value;
  }
  return safe;
}
