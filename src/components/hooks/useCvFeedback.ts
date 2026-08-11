import { useState } from "react";

import { getCvFeedbackCopy } from "@/lib/cv-feedback-copy";
import type { UiLocale } from "@/lib/i18n/locales";
import type { SubmitFeedbackResponse } from "@/types";

export type CvFeedbackStatus = "idle" | "submitting" | "submitted" | "error";

export interface CvFeedbackPayload {
  generationEventId: string;
  helpful: boolean;
  comment?: string;
}

export interface CvFeedbackController {
  status: CvFeedbackStatus;
  /** Localized retry message; non-null only while `status === "error"`. */
  error: string | null;
  /** Clear a previous confirmation after the user changes their verdict or comment. */
  markPending: () => void;
  submit: (generationEventId: string, helpful: boolean, comment?: string) => Promise<void>;
}

const FEEDBACK_ENDPOINT = "/api/cv/feedback";

/**
 * POST one feedback verdict. Resolves `true` on success, `false` on any failure —
 * network, non-JSON, or a `{ ok: false }` envelope. Never throws: feedback is
 * fail-soft and must never block editing, saving, or exporting the draft.
 *
 * A blank/whitespace-only comment is omitted from the body entirely (the server
 * schema normalizes it to `undefined` anyway), so an empty textarea is not stored.
 */
export async function postCvFeedback({ generationEventId, helpful, comment }: CvFeedbackPayload): Promise<boolean> {
  const trimmed = comment?.trim();
  try {
    const response = await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `undefined` values are dropped by JSON.stringify, so a blank comment sends no key.
      body: JSON.stringify({ generationEventId, helpful, comment: trimmed === "" ? undefined : trimmed }),
    });
    const data = (await response.json()) as SubmitFeedbackResponse;
    return data.ok;
  } catch {
    return false;
  }
}

/**
 * Submit state for the post-generation feedback widget (S-05).
 *
 * Mirrors `useCvSave`'s shape: a small status machine plus a localized error string.
 * The server returns stable buckets, but every failure resolves to the same inline
 * retry copy here — the user's only useful action is to try again.
 */
export function useCvFeedback({ locale }: { locale: UiLocale }): CvFeedbackController {
  const copy = getCvFeedbackCopy(locale);
  const [status, setStatus] = useState<CvFeedbackStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  function markPending() {
    setStatus((current) => (current === "submitted" ? "idle" : current));
  }

  async function submit(generationEventId: string, helpful: boolean, comment?: string) {
    setStatus("submitting");
    setError(null);
    const ok = await postCvFeedback({ generationEventId, helpful, comment });
    if (ok) {
      setStatus("submitted");
      return;
    }
    setError(copy.errorRetry);
    setStatus("error");
  }

  return { status, error, markPending, submit };
}
