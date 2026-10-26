import "server-only";

import { addDays, todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { PlanSummary } from "@/lib/workouts/queries";
import { type AttentionItem, attentionItems } from "./attention";
import type { StudentSummary } from "./queries";

const saoPauloDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

export type AttentionData = { workoutDates: { studentId: string; date: string }[]; questionnaires: { studentId: string; needsClearance: boolean }[] };

/** Recent activity and questionnaires; fetched alongside the students and plans the dashboard already loads. */
export async function getAttentionData(workspaceId: string): Promise<AttentionData> {
  const today = todayISO();
  const supabase = await createClient();
  const [logs, questionnaires] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("student_id, completed_at")
      .eq("workspace_id", workspaceId)
      .not("completed_at", "is", null)
      .gte("completed_at", `${addDays(today, -60)}T00:00:00Z`),
    supabase.from("health_questionnaires").select("student_id, needs_clearance, submitted_at").eq("workspace_id", workspaceId).order("submitted_at", { ascending: false }),
  ]);
  if (logs.error) throw new Error(`Failed to load activity: ${logs.error.message}`);
  if (questionnaires.error) throw new Error(`Failed to load questionnaires: ${questionnaires.error.message}`);

  const latest = new Map<string, boolean>();
  for (const q of questionnaires.data) if (!latest.has(q.student_id)) latest.set(q.student_id, q.needs_clearance);

  return {
    workoutDates: logs.data.map((l) => ({ studentId: l.student_id, date: saoPauloDate.format(new Date(l.completed_at!)) })),
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
