import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ParqAnswers } from "./parq";

export type Questionnaire = { answers: ParqAnswers; needsClearance: boolean; submittedAt: string };

/** The student's latest answers, or null. RLS: the student and their staff. */
export async function getLatestQuestionnaire(studentId: string): Promise<Questionnaire | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_questionnaires")
    .select("answers, needs_clearance, submitted_at")
    .eq("student_id", studentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load questionnaire: ${error.message}`);
  return data ? { answers: data.answers as ParqAnswers, needsClearance: data.needs_clearance, submittedAt: data.submitted_at } : null;
}
