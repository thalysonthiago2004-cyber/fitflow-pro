import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CardioIntensity, CardioMode, Equipment, MuscleGroup, PlanStatus } from "@/lib/supabase/database.types";
import type { LastPerformance } from "./progression";

// Every query runs with the caller's session; RLS decides visibility.

export type Exercise = {
  id: string;
  workspaceId: string | null;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  instructions: string | null;
  videoUrl: string | null;
  /** Uploaded video in the `exercise-videos` bucket. */
  videoPath: string | null;
  /** Short-lived signed URL for videoPath, when loaded for display. */
  videoSrc: string | null;
  isGlobal: boolean;
  /** A global exercise with this workspace's own instructions or video. */
  customized: boolean;
};

export type PlanSummary = {
  id: string;
  name: string;
  status: PlanStatus;
  /** Null for templates. */
  studentId: string | null;
  studentName: string;
  isTemplate: boolean;
  startsOn: string | null;
  endsOn: string | null;
  updatedAt: string;
};

type PrescriptionBase = {
  id: string;
  position: number;
  notes: string | null;
  exercise: Pick<Exercise, "id" | "name" | "muscleGroup" | "equipment" | "instructions" | "videoUrl" | "videoSrc">;
};

export type StrengthPrescription = PrescriptionBase & {
  kind: "strength";
  sets: number;
  repsMin: number;
  repsMax: number | null;
  /** Repetitions for each set (e.g. 12/10/8); null when every set shares repsMin–repsMax. */
  repsPerSet: number[] | null;
  /** Items sharing a group are a bi-set, tri-set or circuit. */
  supersetGroup: string | null;
  loadKg: number | null;
  restSeconds: number | null;
};

export type CardioTarget = {
  mode: CardioMode;
  durationMinutes: number | null;
  distanceKm: number | null;
  intensity: CardioIntensity | null;
  hrMin: number | null;
  hrMax: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
  rounds: number | null;
  workSeconds: number | null;
  /** Rest between interval rounds. */
  restSeconds: number | null;
};

export type CardioPrescription = PrescriptionBase & { kind: "cardio"; cardio: CardioTarget };

export type Prescription = StrengthPrescription | CardioPrescription;

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

export type CardioLog = {
  sessionExerciseId: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  avgHr: number | null;
  rpe: number | null;
  roundsDone: number | null;
  completed: boolean;
};

export type LogDetail = LogSummary & {
  notes: string | null;
  planName: string;
  exercises: Prescription[];
  sets: SetLog[];
  cardio: CardioLog[];
  /** Last completed performance of each exercise (by exercise id) before this workout. */
  previous: Record<string, LastPerformance>;
};

type ExerciseRow = {
  id: string;
  workspace_id: string | null;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  instructions: string | null;
  video_url: string | null;
  video_path: string | null;
};

type Customization = { instructions: string | null; video_url: string | null; video_path: string | null };

const EXERCISE_COLUMNS = "id, workspace_id, name, muscle_group, equipment, instructions, video_url, video_path";

// A customization replaces the catalog's instructions and video as a whole, so
// a trainer's own video never shows next to the catalog's instructions by accident.
function toExercise(row: ExerciseRow, custom?: Customization): Exercise {
  const source = custom ?? row;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    instructions: source.instructions,
    videoUrl: source.video_url,
    videoPath: source.video_path,
    videoSrc: null,
    isGlobal: row.workspace_id === null,
    customized: custom !== undefined,
  };
}

/** Customizations visible to the caller (RLS: their workspace) for these exercises. */
async function customizationsFor(ids: string[]): Promise<Map<string, Customization>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_customizations")
    .select("exercise_id, instructions, video_url, video_path")
    .in("exercise_id", [...new Set(ids)]);
  if (error) fail("customizations", error);
  return new Map(data.map((c) => [c.exercise_id, c]));
}

/** Fills videoSrc with signed URLs (1 h) for exercises that have an uploaded video. */
async function withVideoUrls<T extends Pick<Exercise, "videoPath" | "videoSrc">>(exercises: T[]): Promise<T[]> {
  const paths = [...new Set(exercises.flatMap((e) => (e.videoPath ? [e.videoPath] : [])))];
  if (paths.length === 0) return exercises;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("exercise-videos").createSignedUrls(paths, 60 * 60);
  if (error) fail("exercise videos", error);
  const byPath = new Map(data.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  for (const exercise of exercises) exercise.videoSrc = exercise.videoPath ? (byPath.get(exercise.videoPath) ?? null) : null;
  return exercises;
}

const num = (value: number | string | null) => (value === null ? null : Number(value));

function fail(what: string, error: { message: string }): never {
  throw new Error(`Failed to load ${what}: ${error.message}`);
}

export async function listExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .eq("archived", false)
    .order("name");
  if (error) fail("exercises", error);
  const custom = await customizationsFor(data.filter((e) => e.workspace_id === null).map((e) => e.id));
  return data.map((row) => toExercise(row, custom.get(row.id)));
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .eq("id", id)
    .eq("archived", false)
    .maybeSingle();
  if (error) fail("exercise", error);
  if (!data) return null;
  const custom = data.workspace_id === null ? await customizationsFor([data.id]) : new Map<string, Customization>();
  const [exercise] = await withVideoUrls([toExercise(data, custom.get(data.id))]);
  return exercise;
}

async function profileNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", [...new Set(ids)]);
  if (error) fail("profiles", error);
  return new Map(data.map((p) => [p.id, p.full_name]));
}

type PlanFilter = { workspaceId?: string; studentId?: string; statuses?: PlanStatus[]; templates?: boolean };

export async function listPlans(filter: PlanFilter): Promise<PlanSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("workout_plans")
    .select("id, name, status, student_id, is_template, starts_on, ends_on, updated_at")
    .eq("is_template", filter.templates ?? false)
    .order("updated_at", { ascending: false });
  if (filter.workspaceId) query = query.eq("workspace_id", filter.workspaceId);
  if (filter.studentId) query = query.eq("student_id", filter.studentId);
  if (filter.statuses) query = query.in("status", filter.statuses);
  const { data, error } = await query;
  if (error) fail("plans", error);

  const names = await profileNames(data.flatMap((p) => (p.student_id ? [p.student_id] : [])));
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    studentId: p.student_id,
    studentName: p.student_id ? (names.get(p.student_id) ?? "Aluno") : "Modelo",
    isTemplate: p.is_template,
    startsOn: p.starts_on,
    endsOn: p.ends_on,
    updatedAt: p.updated_at,
  }));
}

async function loadSessions(planIds: string[]): Promise<Map<string, SessionDetail[]>> {
  const byPlan = new Map<string, SessionDetail[]>();
  if (planIds.length === 0) return byPlan;
  const supabase = await createClient();

  // One round trip: sessions with their items, exercises and this workspace's
  // customizations (RLS returns only the caller's). Signing videos is a second
  // call only when some exercise has an uploaded video.
  const { data: sessions, error } = await supabase
    .from("workout_sessions")
    .select(
      "id, plan_id, name, weekdays, position, created_at, session_exercises(id, session_id, position, kind, sets, reps_min, reps_max, reps_per_set, superset_group, load_kg, rest_seconds, notes, cardio_mode, duration_minutes, distance_km, intensity, hr_min, hr_max, speed_kmh, incline_pct, rounds, work_seconds, created_at, exercises(id, workspace_id, name, muscle_group, equipment, instructions, video_url, video_path, exercise_customizations(instructions, video_url, video_path)))",
    )
    .in("plan_id", planIds)
    .order("position")
    .order("created_at")
    .order("position", { referencedTable: "session_exercises" })
    .order("created_at", { referencedTable: "session_exercises" });
  if (error) fail("sessions", error);

  const items = sessions.flatMap((session) => session.session_exercises);
  // One Exercise object per item, so signed URLs can be filled in place.
  const exerciseByItem = new Map(
    items.filter((i) => i.exercises).map((i) => {
      const { exercise_customizations: custom, ...row } = i.exercises!;
      return [i.id, toExercise(row, row.workspace_id === null ? custom[0] : undefined)];
    }),
  );
  await withVideoUrls([...exerciseByItem.values()]);

  for (const session of sessions) {
    const exercises: Prescription[] = items
      .filter((item) => item.session_id === session.id && item.exercises)
      .map((item): Prescription => {
        const base = { id: item.id, position: item.position, notes: item.notes, exercise: exerciseByItem.get(item.id)! };
        if (item.kind === "cardio") {
          return {
            ...base,
            kind: "cardio",
            cardio: {
              mode: item.cardio_mode!,
              durationMinutes: item.duration_minutes,
              distanceKm: num(item.distance_km),
              intensity: item.intensity,
              hrMin: item.hr_min,
              hrMax: item.hr_max,
              speedKmh: num(item.speed_kmh),
              inclinePct: num(item.incline_pct),
              rounds: item.rounds,
              workSeconds: item.work_seconds,
              restSeconds: item.rest_seconds,
            },
          };
        }
        // The database guarantees sets and reps for strength items.
        return {
          ...base,
          kind: "strength",
          sets: item.sets!,
          repsMin: item.reps_min!,
          repsMax: item.reps_max,
          repsPerSet: item.reps_per_set,
          supersetGroup: item.superset_group,
          loadKg: num(item.load_kg),
          restSeconds: item.rest_seconds,
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
    .select("id, workspace_id, name, notes, status, student_id, is_template, starts_on, ends_on, updated_at")
    .eq("id", planId)
    .maybeSingle();
  if (error) fail("plan", error);
  if (!plan) return null;

  const [names, sessions] = await Promise.all([profileNames(plan.student_id ? [plan.student_id] : []), loadSessions([plan.id])]);
  return {
    id: plan.id,
    workspaceId: plan.workspace_id,
    name: plan.name,
    notes: plan.notes,
    status: plan.status,
    studentId: plan.student_id,
    studentName: plan.student_id ? (names.get(plan.student_id) ?? "Aluno") : "Modelo",
    isTemplate: plan.is_template,
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

  const [names, sessions, plan, sets, cardio] = await Promise.all([
    profileNames([log.student_id]),
    loadSessions([log.plan_id]),
    supabase.from("workout_plans").select("name").eq("id", log.plan_id).maybeSingle(),
    supabase
      .from("set_logs")
      .select("id, session_exercise_id, set_number, reps, load_kg, completed")
      .eq("log_id", log.id)
      .order("set_number"),
    supabase
      .from("cardio_logs")
      .select("session_exercise_id, duration_minutes, distance_km, avg_hr, rpe, rounds_done, completed")
      .eq("log_id", log.id),
  ]);
  if (sets.error) fail("sets", sets.error);
  if (cardio.error) fail("cardio", cardio.error);
  const session = sessions.get(log.plan_id)?.find((s) => s.id === log.session_id);
  const previous = await lastPerformances(
    log.student_id,
    log.id,
    (session?.exercises ?? []).flatMap((e) => (e.kind === "strength" ? [e.exercise.id] : [])),
  );

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
    cardio: cardio.data.map((c) => ({
      sessionExerciseId: c.session_exercise_id,
      durationMinutes: num(c.duration_minutes),
      distanceKm: num(c.distance_km),
      avgHr: c.avg_hr,
      rpe: c.rpe,
      roundsDone: c.rounds_done,
      completed: c.completed,
    })),
    previous,
  };
}

/** For each exercise, the sets of the student's most recent other completed workout that included it (last 120 days). */
async function lastPerformances(studentId: string, excludeLogId: string, exerciseIds: string[]): Promise<Record<string, LastPerformance>> {
  if (exerciseIds.length === 0) return {};
  const supabase = await createClient();
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("set_logs")
    .select("log_id, set_number, reps, load_kg, completed, session_exercises!inner(exercise_id), workout_logs!inner(student_id, completed_at)")
    .eq("workout_logs.student_id", studentId)
    .gte("workout_logs.completed_at", since)
    .neq("log_id", excludeLogId)
    .in("session_exercises.exercise_id", [...new Set(exerciseIds)]);
  if (error) fail("previous sets", error);

  const latestLog = new Map<string, { logId: string; completedAt: string }>();
  for (const row of data) {
    const exerciseId = row.session_exercises.exercise_id;
    const completedAt = row.workout_logs.completed_at!;
    const current = latestLog.get(exerciseId);
    if (!current || completedAt > current.completedAt) latestLog.set(exerciseId, { logId: row.log_id, completedAt });
  }
  const result: Record<string, LastPerformance> = {};
  for (const [exerciseId, { logId, completedAt }] of latestLog) {
    result[exerciseId] = {
      date: completedAt,
      sets: data
        .filter((row) => row.log_id === logId && row.session_exercises.exercise_id === exerciseId)
        .map((row) => ({ setNumber: row.set_number, reps: row.reps, loadKg: num(row.load_kg), completed: row.completed }))
        .sort((a, b) => a.setNumber - b.setNumber),
    };
  }
  return result;
}
