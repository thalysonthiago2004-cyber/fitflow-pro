import { daysBetweenDates } from "@/lib/format";

// What a trainer should look at today. Pure so it can be tested; the
// dashboard feeds it RLS-scoped rows.

export type AttentionInput = {
  today: string; // YYYY-MM-DD, São Paulo
  students: { userId: string; fullName: string; status: "active" | "archived"; joinedAt: string }[];
  activePlans: { studentId: string | null; name: string; endsOn: string | null; id: string }[];
  /** São Paulo dates of completed workouts per student (any order). */
  workoutDates: { studentId: string; date: string }[];
  /** Latest questionnaire per student, if any. */
  questionnaires: { studentId: string; needsClearance: boolean }[];
};

export type AttentionItem = { studentId: string; studentName: string; reason: string; href: string };

const daysBetween = daysBetweenDates;

export const INACTIVE_DAYS = 7;
export const ENDING_SOON_DAYS = 7;

export function attentionItems(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const active = input.students.filter((s) => s.status === "active");
  const lastWorkout = new Map<string, string>();
  for (const { studentId, date } of input.workoutDates) {
    if ((lastWorkout.get(studentId) ?? "") < date) lastWorkout.set(studentId, date);
  }

  for (const student of active) {
    const base = { studentId: student.userId, studentName: student.fullName };
    const plans = input.activePlans.filter((p) => p.studentId === student.userId);
    const questionnaire = input.questionnaires.find((q) => q.studentId === student.userId);

    if (questionnaire?.needsClearance) {
      items.push({ ...base, reason: "Anamnese indica liberação médica antes de treinar", href: `/students/${student.userId}` });
    }
    if (plans.length === 0) {
      items.push({ ...base, reason: "Sem plano de treino ativo", href: `/workouts/new?student=${student.userId}` });
    }
    const last = lastWorkout.get(student.userId);
    const since = last ?? student.joinedAt.slice(0, 10);
    const idle = daysBetween(since, input.today);
    if (plans.length > 0 && idle >= INACTIVE_DAYS) {
      items.push({ ...base, reason: last ? `Sem treinar há ${idle} dias` : `Ainda não registrou treinos (entrou há ${idle} dias)`, href: `/students/${student.userId}` });
    }
    for (const plan of plans) {
      if (!plan.endsOn) continue;
      const left = daysBetween(input.today, plan.endsOn);
      if (left >= 0 && left <= ENDING_SOON_DAYS) {
        items.push({ ...base, reason: left === 0 ? `"${plan.name}" termina hoje` : `"${plan.name}" termina em ${left} ${left === 1 ? "dia" : "dias"}`, href: `/workouts/${plan.id}` });
      }
    }
  }
  return items;
}
