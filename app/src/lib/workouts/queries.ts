import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Equipment, MuscleGroup, PlanStatus } from "@/lib/supabase/database.types";

// Every query runs with the caller's session; RLS decides visibility.

export type Exercise = {
  id: string;
  workspaceId: string | null;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  instructions: string | null;
  videoUrl: string | null;
  isGlobal: boolean;
};

export type PlanSummary = {
  id: string;
  name: string;
  status: PlanStatus;
  studentId: string;
  studentName: string;
  startsOn: string | null;
  endsOn: string | null;
  updatedAt: string;
};

export type Prescription = {
  id: string;
  position: number;
  sets: number;
  repsMin: number;
  repsMax: number | null;
  loadKg: number | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: Pick<Exercise, "id" | "name" | "muscleGroup" | "equipment" | "instructions" | "videoUrl">;
};

export type SessionDetail = {
  id: string;
  name: string;
  weekdays: number[];
  position: number;
  exercises: Prescription[];
};

export type PlanDetail = PlanSummary & {
  workspaceId: string;
  notes: string | null;
  sessions: SessionDetail[];
};

export type LogSummary = {
  id: string;
  planId: string;
  sessionId: string;
  sessionName: string;
  studentId: string;
  studentName: string;
  startedAt: string;
  completedAt: string | null;
};

export type SetLog = {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  reps: number | null;
  loadKg: number | null;
  completed: boolean;
};

export type LogDetail = LogSummary & {
  notes: string | null;
  planName: string;
  exercises: Prescription[];
  sets: SetLog[];
};

type ExerciseRow = {
  id: string;
  workspace_id: string | null;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  instructions: string | null;
  video_url: string | null;
};

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    instructions: row.instructions,
    videoUrl: row.video_url,
    isGlobal: row.workspace_id === null,
  };
}

const num = (value: number | string | null) => (value === null ? null : Number(value));

function fail(what: string, error: { message: string }): never {
  throw new Error(`Failed to load ${what}: ${error.message}`);
}

export async function listExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, workspace_id, name, muscle_group, equipment, instructions, video_url")
    .eq("archived", false)
    .order("name");
  if (error) fail("exercises", error);
  return data.map(toExercise);
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, workspace_id, name, muscle_group, equipment, instructions, video_url")
    .eq("id", id)
    .eq("archived", false)
    .maybeSingle();
  if (error) fail("exercise", error);
  return data ? toExercise(data) : null;
}

async function profileNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", [...new Set(ids)]);
  if (error) fail("profiles", error);
  return new Map(data.map((p) => [p.id, p.full_name]));
}

type PlanFilter = { workspaceId?: string; studentId?: string; statuses?: PlanStatus[] };

export async function listPlans(filter: PlanFilter): Promise<PlanSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("workout_plans")
    .select("id, name, status, student_id, starts_on, ends_on, updated_at")
    .order("updated_at", { ascending: false });
  if (filter.workspaceId) query = query.eq("workspace_id", filter.workspaceId);
  if (filter.studentId) query = query.eq("student_id", filter.studentId);
  if (filter.statuses) query = query.in("status", filter.statuses);
  const { data, error } = await query;
  if (error) fail("plans", error);

  const names = await profileNames(data.map((p) => p.student_id));
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    studentId: p.student_id,
    studentName: names.get(p.student_id) ?? "Aluno",
    startsOn: p.starts_on,
    endsOn: p.ends_on,
    updatedAt: p.updated_at,
  }));
}

async function loadSessions(planIds: string[]): Promise<Map<string, SessionDetail[]>> {
  const byPlan = new Map<string, SessionDetail[]>();
  if (planIds.length === 0) return byPlan;
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select("id, plan_id, name, weekdays, position, created_at")
    .in("plan_id", planIds)
    .order("position")
    .order("created_at");
  if (error) fail("sessions", error);

  const sessionIds = sessions.map((s) => s.id);
  const { data: items, error: itemsError } = sessionIds.length
    ? await supabase
        .from("session_exercises")
        .select(
          "id, session_id, position, sets, reps_min, reps_max, load_kg, rest_seconds, notes, created_at, exercises(id, workspace_id, name, muscle_group, equipment, instructions, video_url)",
        )
        .in("session_id", sessionIds)
        .order("position")
        .order("created_at")
    : { data: [], error: null };
  if (itemsError) fail("session exercises", itemsError);

  for (const session of sessions) {
    const exercises: Prescription[] = items
      .filter((item) => item.session_id === session.id && item.exercises)
      .map((item) => {
        const exercise = toExercise(item.exercises!);
        return {
          id: item.id,
          position: item.position,
          sets: item.sets,
          repsMin: item.reps_min,
          repsMax: item.reps_max,
          loadKg: num(item.load_kg),
          restSeconds: item.rest_seconds,
          notes: item.notes,
          exercise,
        };
      });
    const list = byPlan.get(session.plan_id) ?? [];
    list.push({ id: session.id, name: session.name, weekdays: session.weekdays, position: session.position, exercises });
    byPlan.set(session.plan_id, list);
  }
  return byPlan;
}

export async function getPlan(planId: string): Promise<PlanDetail | null> {
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("workout_plans")
    .select("id, workspace_id, name, notes, status, student_id, starts_on, ends_on, updated_at")
    .eq("id", planId)
    .maybeSingle();
  if (error) fail("plan", error);
  if (!plan) return null;

  const [names, sessions] = await Promise.all([profileNames([plan.student_id]), loadSessions([plan.id])]);
  return {
    id: plan.id,
    workspaceId: plan.workspace_id,
    name: plan.name,
    notes: plan.notes,
    status: plan.status,
    studentId: plan.student_id,
    studentName: names.get(plan.student_id) ?? "Aluno",
    startsOn: plan.starts_on,
    endsOn: plan.ends_on,
    updatedAt: plan.updated_at,
    sessions: sessions.get(plan.id) ?? [],
  };
}

/** Published plans of the signed-in student, with their sessions. */
export async function getStudentPlans(studentId: string): Promise<PlanDetail[]> {
  const plans = await listPlans({ studentId, statuses: ["active"] });
  const sessions = await loadSessions(plans.map((p) => p.id));
  return plans.map((p) => ({ ...p, workspaceId: "", notes: null, sessions: sessions.get(p.id) ?? [] }));
}

type LogFilter = { studentId?: string; workspaceId?: string; limit?: number; completedOnly?: boolean };

export async function listLogs(filter: LogFilter): Promise<LogSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("workout_logs")
    .select("id, plan_id, session_id, student_id, started_at, completed_at")
    .order("started_at", { ascending: false })
    .limit(filter.limit ?? 20);
  if (filter.studentId) query = query.eq("student_id", filter.studentId);
  if (filter.workspaceId) query = query.eq("workspace_id", filter.workspaceId);
  if (filter.completedOnly) query = query.not("completed_at", "is", null);
  const { data, error } = await query;
  if (error) fail("logs", error);

  const sessionIds = [...new Set(data.map((l) => l.session_id))];
  const [names, sessions] = await Promise.all([
    profileNames(data.map((l) => l.student_id)),
    sessionIds.length
      ? supabase.from("workout_sessions").select("id, name").in("id", sessionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);
  if (sessions.error) fail("sessions", sessions.error);
  const sessionNames = new Map(sessions.data.map((s) => [s.id, s.name]));

  return data.map((l) => ({
    id: l.id,
    planId: l.plan_id,
    sessionId: l.session_id,
    sessionName: sessionNames.get(l.session_id) ?? "Treino",
    studentId: l.student_id,
    studentName: names.get(l.student_id) ?? "Aluno",
    startedAt: l.started_at,
    completedAt: l.completed_at,
  }));
}

export async function getOpenLog(studentId: string): Promise<LogSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("student_id", studentId)
    .is("completed_at", null)
    .maybeSingle();
  if (error) fail("open log", error);
  if (!data) return null;
  const logs = await listLogs({ studentId, limit: 5 });
  return logs.find((l) => l.id === data.id) ?? null;
}

export async function getLog(logId: string): Promise<LogDetail | null> {
  const supabase = await createClient();
  const { data: log, error } = await supabase
    .from("workout_logs")
    .select("id, plan_id, session_id, student_id, started_at, completed_at, notes")
    .eq("id", logId)
    .maybeSingle();
  if (error) fail("log", error);
  if (!log) return null;

  const [names, sessions, plan, sets] = await Promise.all([
    profileNames([log.student_id]),
    loadSessions([log.plan_id]),
    supabase.from("workout_plans").select("name").eq("id", log.plan_id).maybeSingle(),
    supabase
      .from("set_logs")
      .select("id, session_exercise_id, set_number, reps, load_kg, completed")
      .eq("log_id", log.id)
      .order("set_number"),
  ]);
  if (sets.error) fail("sets", sets.error);
  const session = sessions.get(log.plan_id)?.find((s) => s.id === log.session_id);

  return {
    id: log.id,
    planId: log.plan_id,
    sessionId: log.session_id,
    sessionName: session?.name ?? "Treino",
    studentId: log.student_id,
    studentName: names.get(log.student_id) ?? "Aluno",
    startedAt: log.started_at,
    completedAt: log.completed_at,
    notes: log.notes,
    planName: plan.data?.name ?? "Plano",
    exercises: session?.exercises ?? [],
    sets: sets.data.map((s) => ({
      id: s.id,
      sessionExerciseId: s.session_exercise_id,
      setNumber: s.set_number,
      reps: s.reps,
      loadKg: num(s.load_kg),
      completed: s.completed,
    })),
  };
}
