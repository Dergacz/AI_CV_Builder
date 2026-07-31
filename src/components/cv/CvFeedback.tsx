import { useState } from "react";

import { getCvFeedbackCopy } from "@/lib/cv-feedback-copy";
import type { UiLocale } from "@/lib/i18n/locales";
import { useCvFeedback } from "@/components/hooks/useCvFeedback";
import { cn } from "@/lib/utils";

const COMMENT_MAX_LENGTH = 1000;

/**
 * Post-generation feedback widget (S-05 / FR-010).
 *
 * Renders inline under the generated draft: a Helpful / Not-helpful verdict plus an
 * optional comment. Submission is an upsert keyed by `generationEventId`, so the user
 * can change their mind and re-send — the verdict buttons and textarea stay live after
 * a successful submit and clear the confirmation as soon as anything changes.
 *
 * Fail-soft by construction: a failed submit shows an inline retry and never blocks
 * editing, saving, or exporting. The mount site keys this component on
 * `generationEventId` so a regeneration remounts it in its unsubmitted state.
 *
 * Privacy (F-01): the comment reaches `public.feedback` only. The analytics event the
 * endpoint emits carries the verdict, locale, and generation event id — never the text.
 */
export default function CvFeedback({ generationEventId, locale }: { generationEventId: string; locale: UiLocale }) {
  const copy = getCvFeedbackCopy(locale);
  const feedback = useCvFeedback({ locale });
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");

  const isSubmitting = feedback.status === "submitting";
  const hasVerdict = helpful !== null;

  function chooseVerdict(value: boolean) {
    setHelpful(value);
    feedback.markPending();
  }

  return (
    <section aria-label={copy.regionAriaLabel} className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{copy.title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy.description}</p>

      <div className="mt-3 flex flex-wrap gap-3" role="group" aria-label={copy.verdictGroupAriaLabel}>
        <VerdictButton
          label={copy.helpful}
          selected={helpful === true}
          disabled={isSubmitting}
          onClick={() => {
            chooseVerdict(true);
          }}
        />
        <VerdictButton
          label={copy.notHelpful}
          selected={helpful === false}
          disabled={isSubmitting}
          onClick={() => {
            chooseVerdict(false);
          }}
        />
      </div>

      {hasVerdict && (
        <div className="mt-4">
          <label htmlFor="cv-feedback-comment" className="text-sm font-medium text-slate-700">
            {copy.commentLabel}
          </label>
          <textarea
            id="cv-feedback-comment"
            value={comment}
            rows={3}
            maxLength={COMMENT_MAX_LENGTH}
            disabled={isSubmitting}
            placeholder={copy.commentPlaceholder}
            onChange={(event) => {
              setComment(event.target.value);
              feedback.markPending();
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 transition-colors focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-700/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
          />
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              void feedback.submit(generationEventId, helpful, comment);
            }}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-emerald-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {isSubmitting ? copy.submitting : copy.submit}
          </button>
        </div>
      )}

      {feedback.status === "submitted" && (
        <p role="status" aria-live="polite" className="mt-3 text-sm font-medium text-emerald-700">
          {copy.thanks}
        </p>
      )}

      {feedback.status === "error" && feedback.error && (
        <div
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-900"
        >
          {feedback.error}
        </div>
      )}
    </section>
  );
}

function VerdictButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-md border px-5 py-3 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-emerald-700/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-emerald-700 bg-emerald-50 text-emerald-900"
          : "border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-100",
      )}
    >
      {label}
    </button>
  );
}
