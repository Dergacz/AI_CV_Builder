import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/db/database.types";

type TypedSupabaseClient = SupabaseClient<Database>;

export interface FeedbackPayload {
  generationEventId: string;
  helpful: boolean;
  comment?: string;
}

/**
 * Upsert one feedback row for (userId, generationEventId).
 *
 * On conflict (same user + generation event), updates helpful + comment so
 * the user can correct their verdict without creating duplicate rows.
 * Privacy (F-01): never writes draft/answer content — only the UUID key,
 * the boolean verdict, and the optional raw comment.
 */
export async function upsertFeedback(
  supabase: TypedSupabaseClient,
  userId: string,
  payload: FeedbackPayload,
): Promise<void> {
  const { error } = await supabase.from("feedback").upsert(
    {
      user_id: userId,
      generation_event_id: payload.generationEventId,
      helpful: payload.helpful,
      comment: payload.comment ?? null,
    },
    { onConflict: "user_id,generation_event_id" },
  );

  if (error) {
    throw error;
  }
}
