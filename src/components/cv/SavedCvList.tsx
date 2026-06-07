import { useState } from "react";

import { getCvLibraryCopy } from "@/lib/cv-library-copy";
import { getCvSaveErrorMessages } from "@/lib/cv-save-messages";
import { getMessages } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/locales";
import type { DeleteCvResponse, SavedCvSummary } from "@/types";
import ConfirmDialog from "@/components/cv/ConfirmDialog";

/**
 * Dashboard saved-CV library (S-06).
 *
 * Hydrates from the server-rendered summary list; each card opens the reopen route or
 * deletes via the shared confirm dialog. A successful DELETE removes the card in place;
 * failures surface a `role="alert"` message and leave the card untouched.
 *
 * S-09: all chrome follows the interface `locale`. The per-card language pill localizes the
 * label for the CV's output language while leaving the stored `cv.language` value untouched.
 */

// Deterministic YYYY-MM-DD: `toLocaleDateString()` differs between the SSR (workerd)
// and browser locales, which would cause a hydration mismatch on this client:load island.
function formatUpdated(iso: string): string {
  return Number.isNaN(new Date(iso).getTime()) ? iso : iso.slice(0, 10);
}

export default function SavedCvList({ cvs: initialCvs, locale }: { cvs: SavedCvSummary[]; locale: UiLocale }) {
  const copy = getCvLibraryCopy(locale);
  const saveErrors = getCvSaveErrorMessages(locale);
  const languageLabels = getMessages(locale).questionnaire.outputLanguageNames;
  const [cvs, setCvs] = useState(initialCvs);
  const [pendingDelete, setPendingDelete] = useState<SavedCvSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const target = pendingDelete;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/cv/${target.id}`, { method: "DELETE" });
      const data = (await response.json()) as DeleteCvResponse;
      if (data.ok) {
        setCvs((current) => current.filter((cv) => cv.id !== target.id));
        setPendingDelete(null);
      } else {
        setError(saveErrors[data.error]);
      }
    } catch {
      setError(saveErrors.delete_failed);
    } finally {
      setDeleting(false);
    }
  }

  if (cvs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
        <h3 className="text-base font-semibold text-slate-950">{copy.dashboard.emptyTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{copy.dashboard.emptyBody}</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"
        >
          {error}
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {cvs.map((cv) => (
          <li
            key={cv.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-950">{cv.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {languageLabels[cv.language]} · {copy.card.updatedPrefix} {formatUpdated(cv.updatedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/cv/${cv.id}`}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:ring-3 focus-visible:ring-emerald-700/30 focus-visible:outline-none"
              >
                {copy.card.open}
              </a>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPendingDelete(cv);
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-800 focus-visible:ring-3 focus-visible:ring-red-700/20 focus-visible:outline-none"
              >
                {copy.card.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete && (
        <ConfirmDialog
          title={copy.delete.confirmTitle}
          body={copy.delete.confirmBody}
          confirmLabel={deleting ? copy.saveBar.saving : copy.delete.confirm}
          cancelLabel={copy.delete.cancel}
          confirmDisabled={deleting}
          onConfirm={() => {
            void confirmDelete();
          }}
          onCancel={() => {
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}
