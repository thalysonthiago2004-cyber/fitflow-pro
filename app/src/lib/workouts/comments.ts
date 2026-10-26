import "server-only";

import { createClient } from "@/lib/supabase/server";

export type WorkoutComment = { id: string; authorId: string; authorName: string; body: string; createdAt: string };

/** Oldest first. RLS: the log's student and their staff. */
export async function listComments(logId: string): Promise<WorkoutComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("workout_comments").select("id, author_id, body, created_at").eq("log_id", logId).order("created_at");
  if (error) throw new Error(`Failed to load comments: ${error.message}`);
  const ids = [...new Set(data.map((c) => c.author_id))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return data.map((c) => ({ id: c.id, authorId: c.author_id, authorName: names.get(c.author_id) ?? "—", body: c.body, createdAt: c.created_at }));
}
