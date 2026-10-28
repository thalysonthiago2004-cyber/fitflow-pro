import "server-only";

import { addDays, todayISO } from "@/lib/format";
import { getWorkspaceCompletions } from "@/lib/progress/queries";
import { createClient } from "@/lib/supabase/server";
import type { PlanSummary } from "@/lib/workouts/queries";
import { type AttentionItem, attentionItems } from "./attention";
import type { StudentSummary } from "./queries";

export type AttentionData = { workoutDates: { studentId: string; date: string }[]; questionnaires: { studentId: string; needsClearance: boolean }[] };

/** Recent activity and questionnaires; fetched alongside the students and plans the dashboard already loads. */
export async function getAttentionData(workspaceId: string): Promise<AttentionData> {
  const today = todayISO();
  const supabase = await createClient();
  const [workoutDates, questionnaires] = await Promise.all([
    // Paged: a busy workspace passes the per-call row cap in 60 days.
    getWorkspaceCompletions(workspaceId, addDays(today, -60)),
    supabase.from("health_questionnaires").select("student_id, needs_clearance, submitted_at").eq("workspace_id", workspaceId).order("submitted_at", { ascending: false }),
  ]);
  if (questionnaires.error) throw new Error(`Failed to load questionnaires: ${questionnaires.error.message}`);

  const latest = new Map<string, boolean>();
  for (const q of questionnaires.data) if (!latest.has(q.student_id)) latest.set(q.student_id, q.needs_clearance);

  return {
    workoutDates,
    questionnaires: [...latest].map(([studentId, needsClearance]) => ({ studentId, needsClearance })),
  };
}

export function buildAttention(data: AttentionData, students: StudentSummary[], activePlans: PlanSummary[]): AttentionItem[] {
  return attentionItems({
    today: todayISO(),
    students,
    activePlans: activePlans.map((p) => ({ id: p.id, studentId: p.studentId, name: p.name, endsOn: p.endsOn })),
    ...data,
  });
}
