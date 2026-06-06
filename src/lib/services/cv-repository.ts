import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/db/database.types";
import { QUESTIONNAIRE_VERSION, type CvOutputLanguage, type CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import type { GeneratedCvDraft } from "@/lib/cv-draft";
import { defaultCvTitle } from "@/lib/cv-library-copy";
import type { SavedCv, SavedCvSummary, SourceSnapshot } from "@/types";

/**
 * Saved-CV data access (F-02 persistence contract / S-06).
 *
 * Thin typed query functions over the `cvs` table — no HTTP, no envelope. Owner
 * identity is always supplied by the caller from the verified `auth.getUser()` id
 * and applied to every query; RLS is the load-bearing guard, these filters are
 * defense-in-depth. `source_snapshot` is assembled here so callers can't shape it.
 *
 * Privacy (F-02): never log raw `draft`/`answers`. These functions throw on DB
 * error and let the route map failures to stable buckets.
 */

type TypedSupabaseClient = SupabaseClient<Database>;

/** Input accepted by create/update — the validated save payload minus identity. */
export interface SaveCvInput {
  title?: string;
  draft: GeneratedCvDraft;
  answers: CvQuestionnaireAnswers;
}

/** Columns selected for the content-free library listing. */
const SUMMARY_COLUMNS = "id, title, language, created_at, updated_at" as const;

interface SummaryRow {
  id: string;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
}

/** jsonb columns are typed as `Json`; our structured shapes round-trip through it. */
function toJson(value: GeneratedCvDraft | SourceSnapshot): Json {
  return value as unknown as Json;
}

function mapSummary(row: SummaryRow): SavedCvSummary {
  return {
    id: row.id,
    title: row.title,
    // DB check constraint guarantees one of the supported languages.
    language: row.language as CvOutputLanguage,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildSourceSnapshot(answers: CvQuestionnaireAnswers): SourceSnapshot {
  return {
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    answers,
    capturedAt: new Date().toISOString(),
  };
}

/** List the owner's CVs, newest-updated first. Content-free summaries. */
export async function listCvs(supabase: TypedSupabaseClient, userId: string): Promise<SavedCvSummary[]> {
  const { data, error } = await supabase
    .from("cvs")
    .select(SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data.map(mapSummary);
}

/** Load one owned CV in full, or `null` when missing / not owned (RLS-filtered). */
export async function getCv(supabase: TypedSupabaseClient, userId: string, id: string): Promise<SavedCv | null> {
  const { data, error } = await supabase.from("cvs").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    ...mapSummary(data),
    draft: data.draft as unknown as GeneratedCvDraft,
    sourceSnapshot: data.source_snapshot as unknown as SourceSnapshot,
  };
}

/** Insert a new CV owned by `userId`. Title defaults from answers when absent. */
export async function createCv(
  supabase: TypedSupabaseClient,
  userId: string,
  input: SaveCvInput,
): Promise<SavedCvSummary> {
  const title = input.title ?? defaultCvTitle(input.answers, new Date());
  const { data, error } = await supabase
    .from("cvs")
    .insert({
      user_id: userId,
      title,
      language: input.draft.language,
      draft: toJson(input.draft),
      source_snapshot: toJson(buildSourceSnapshot(input.answers)),
    })
    .select(SUMMARY_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return mapSummary(data);
}

/**
 * Update an owned CV's draft/snapshot/language (and title when provided). Returns
 * `null` when the row is missing / not owned. `updated_at` is bumped by the DB trigger.
 */
export async function updateCv(
  supabase: TypedSupabaseClient,
  userId: string,
  id: string,
  input: SaveCvInput,
): Promise<SavedCvSummary | null> {
  const updates: Database["public"]["Tables"]["cvs"]["Update"] = {
    language: input.draft.language,
    draft: toJson(input.draft),
    source_snapshot: toJson(buildSourceSnapshot(input.answers)),
  };
  // Only overwrite the title when the caller supplied one — never clobber it with a default.
  if (input.title !== undefined) {
    updates.title = input.title;
  }
  const { data, error } = await supabase
    .from("cvs")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select(SUMMARY_COLUMNS)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapSummary(data) : null;
}

/** Hard-delete an owned CV. Returns `true` when a row was removed. */
export async function deleteCv(supabase: TypedSupabaseClient, userId: string, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("cvs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data !== null;
}
