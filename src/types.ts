/**
 * Shared entity and DTO types for the app.
 *
 * The generated-CV-draft types are defined once in `src/lib/cv-draft.ts` (derived
 * from the zod schema, which is the single source of truth) and re-exported here so
 * consumers can import shared types from `@/types` per project convention.
 */
export type {
  GeneratedCvDraft,
  SummarySection,
  ExperienceItem,
  EducationItem,
  SkillGroup,
  LanguageItem,
  DraftAssumption,
  DraftWarning,
  DraftWarningCode,
  GenerationErrorBucket,
  GenerateDraftResponse,
} from "@/lib/cv-draft";

import type { GeneratedCvDraft } from "@/lib/cv-draft";
import type { CvOutputLanguage, CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import type { CvSaveErrorBucket } from "@/lib/cv-save-messages";

/**
 * Saved-CV entity and DTO types (F-02 persistence contract / S-06).
 *
 * `source_snapshot` captures the questionnaire answers that produced a draft —
 * these live outside `GeneratedCvDraft`, so they are threaded separately on save
 * and restored on reopen. Listable fields are kept flat (no draft) for the library.
 */

/** Snapshot of the inputs that produced a saved CV; stored as `cvs.source_snapshot`. */
export interface SourceSnapshot {
  questionnaireVersion: string;
  answers: CvQuestionnaireAnswers;
  capturedAt: string;
}

/** Library-listing shape — flat, content-free (no `draft`/`source_snapshot`). */
export interface SavedCvSummary {
  id: string;
  title: string;
  language: CvOutputLanguage;
  createdAt: string;
  updatedAt: string;
}

/** A fully-loaded saved CV, including the draft and its source snapshot. */
export interface SavedCv extends SavedCvSummary {
  draft: GeneratedCvDraft;
  sourceSnapshot: SourceSnapshot;
}

/**
 * Saved-CV API response envelopes (discriminated on `ok`), mirroring the
 * generation route's `{ ok: true, ... } | { ok: false, error, message }` shape.
 * Shared by the routes and the client islands that consume them.
 */
export interface CvErrorResponse {
  ok: false;
  error: CvSaveErrorBucket;
  message: string;
}
export type ListCvsResponse = { ok: true; cvs: SavedCvSummary[] } | CvErrorResponse;
export type GetCvResponse = { ok: true; cv: SavedCv } | CvErrorResponse;
/** Create (POST) and update (PUT) both return the saved summary. */
export type SaveCvResponse = { ok: true; cv: SavedCvSummary } | CvErrorResponse;
export type DeleteCvResponse = { ok: true } | CvErrorResponse;

/**
 * Entitlement contract (F-01). The single shape every gated path reads to decide
 * a user's generation quality. Resolved server-side from the `subscriptions` store
 * against the DB clock; absence of a subscription ⇒ Basic. Presented to users only
 * as "Basic" vs "Advanced" — never model names (FR-004).
 */
export type GenerationTier = "basic" | "advanced";

export interface EntitlementStatus {
  tier: GenerationTier;
  /** True iff the user is Advanced right now (paid period not yet elapsed). */
  isAdvanced: boolean;
  /** ISO `current_period_end` while Advanced; `null` when Basic. */
  activeUntil: string | null;
}
