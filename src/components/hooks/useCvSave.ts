import { useCallback, useState } from "react";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import type { CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import { cvSaveErrorMessages } from "@/lib/cv-save-messages";
import type { SaveCvResponse } from "@/types";

export type CvSaveStatus = "idle" | "saving" | "saved" | "error";

export interface CvSaveController {
  /** Undefined until the first successful save; presence switches save() to UPDATE mode. */
  cvId: string | undefined;
  /** Controlled title for the save bar input. */
  title: string;
  setTitle: (title: string) => void;
  status: CvSaveStatus;
  error: string | null;
  /** Mark the current saved confirmation stale after draft edits. */
  markUnsaved: () => void;
  /** Persist the current draft + answers: POST (create) when no cvId, else PUT (update). */
  save: (draft: GeneratedCvDraft, answers: CvQuestionnaireAnswers) => Promise<void>;
}

const CV_ENDPOINT = "/api/cv";
const NETWORK_FALLBACK = cvSaveErrorMessages.service_unavailable;

/**
 * Owns saved-CV identity and persistence for the editor (S-06).
 *
 * `init` pre-seeds identity/title for the reopen flow (Phase 5) so its first save is
 * already an UPDATE. In the creation flow it starts empty and the title is seeded at
 * generation time from the answers. Same-origin `fetch` sends the Origin header, so
 * Astro's CSRF check passes without manual headers.
 */
export function useCvSave(init?: { cvId?: string; title?: string }): CvSaveController {
  const [cvId, setCvId] = useState<string | undefined>(init?.cvId);
  const [title, setTitleState] = useState<string>(init?.title ?? "");
  const [status, setStatus] = useState<CvSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const setTitle = useCallback((next: string) => {
    setTitleState(next);
    // Editing the title after a save means there are unsaved changes again.
    setStatus((current) => (current === "saved" ? "idle" : current));
  }, []);

  const markUnsaved = useCallback(() => {
    setStatus((current) => (current === "saved" ? "idle" : current));
  }, []);

  const save = useCallback<CvSaveController["save"]>(
    async (draft, answers) => {
      setStatus("saving");
      setError(null);
      const trimmed = title.trim();
      const url = cvId ? `${CV_ENDPOINT}/${cvId}` : CV_ENDPOINT;
      const method = cvId ? "PUT" : "POST";
      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          // Empty title → undefined so the server fills a default (create) or keeps it (update).
          body: JSON.stringify({ id: cvId, title: trimmed || undefined, draft, answers }),
        });
        const data = (await response.json()) as SaveCvResponse;
        if (data.ok) {
          setCvId(data.cv.id);
          setTitleState(data.cv.title);
          setStatus("saved");
        } else {
          setError(data.message);
          setStatus("error");
        }
      } catch {
        // Network failure or non-JSON response — temporary, not the user's fault.
        setError(NETWORK_FALLBACK);
        setStatus("error");
      }
    },
    [cvId, title],
  );

  return { cvId, title, setTitle, status, error, markUnsaved, save };
}
