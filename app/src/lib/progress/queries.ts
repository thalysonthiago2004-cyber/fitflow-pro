import "server-only";

import { fail } from "@/lib/query-utils";
import { addDays, todayISO } from "@/lib/format";
import type { MeasurementSource, Sex } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type LoggedSet, type PersonalRecord, personalRecords, weeklyCounts } from "./calc";
import { loadHistory } from "@/lib/workouts/progression";
import { MEASUREMENT_FIELDS, type MeasurementKey } from "./schemas";

export type Measurement = { id: string; measuredOn: string; source: MeasurementSource; notes: string | null; recordedBy: string; recordedByName: string } & Record<
  MeasurementKey,
  number | null
>;


/** Newest first. RLS limits rows to the student and their staff. */
export async function listMeasurements(studentId: string): Promise<Measurement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("student_id", studentId)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) fail("measurements", error);

  const recorders = [...new Set(data.map((m) => m.recorded_by))];
  const { data: names } = recorders.length
    ? await supabase.from("profiles").select("id, full_name").in("id", recorders)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((names ?? []).map((p) => [p.id, p.full_name]));

  return data.map((row) => {
    const values = Object.fromEntries(
      MEASUREMENT_FIELDS.map((f) => [f.key, row[f.column] === null ? null : Number(row[f.column])]),
    ) as Record<MeasurementKey, number | null>;
    return {
      id: row.id,
      measuredOn: row.measured_on,
      source: row.source,
      notes: row.notes,
      recordedBy: row.recorded_by,
      recordedByName: nameById.get(row.recorded_by) ?? "—",
      ...values,
    };
  });
}

/** Latest weight measured on or before `date` (YYYY-MM-DD). */
export async function getWeightOn(studentId: string, date: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("weight_kg")
    .eq("student_id", studentId)
    .not("weight_kg", "is", null)
    .lte("measured_on", date)
    .order("measured_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("weight", error);
  return data?.weight_kg == null ? null : Number(data.weight_kg);
}

/** Completed sets with load from the student's finished workouts. */
async function loggedSets(studentId: string): Promise<LoggedSet[]> {
  const supabase = await createClient();
  const { data: logs, error } = await supabase
    .from("workout_logs")
    .select("id, started_at")
    .eq("student_id", studentId)
    .not("completed_at", "is", null);
  if (error) fail("logs", error);
  if (logs.length === 0) return [];

  const { data: sets, error: setsError } = await supabase
    .from("set_logs")
    .select("log_id, session_exercise_id, reps, load_kg")
    .in("log_id", logs.map((l) => l.id))
    .eq("completed", true)
    .not("load_kg", "is", null);
  if (setsError) fail("sets", setsError);
  if (sets.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("session_exercises")
    .select("id, exercises(id, name)")
    .in("id", [...new Set(sets.map((s) => s.session_exercise_id))]);
  if (itemsError) fail("exercises", itemsError);

  const exerciseByItem = new Map(items.filter((i) => i.exercises).map((i) => [i.id, i.exercises!]));
  const dateByLog = new Map(logs.map((l) => [l.id, l.started_at.slice(0, 10)]));
  return sets.flatMap((s) => {
    const exercise = exerciseByItem.get(s.session_exercise_id);
    if (!exercise) return [];
    return [{ exerciseId: exercise.id, exerciseName: exercise.name, reps: s.reps, loadKg: s.load_kg === null ? null : Number(s.load_kg), date: dateByLog.get(s.log_id)! }];
  });
}

export type LoadSeries = { exerciseId: string; exerciseName: string; points: { date: string; value: number }[] };

/** Personal records and the best load per day for each exercise, from one read of the logs. */
export async function getStrengthProgress(studentId: string): Promise<{ records: PersonalRecord[]; series: LoadSeries[] }> {
  const sets = await loggedSets(studentId);
  const byExercise = new Map<string, LoggedSet[]>();
  for (const set of sets) byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) ?? []), set]);
  const series = [...byExercise.values()]
    .map((list) => ({ exerciseId: list[0].exerciseId, exerciseName: list[0].exerciseName, points: loadHistory(list) }))
    .filter((s) => s.points.length > 0)
    .sort((a, b) => b.points.length - a.points.length || a.exerciseName.localeCompare(b.exerciseName, "pt-BR"));
  return { records: personalRecords(sets), series };
}

export async function getWeeklyWorkouts(studentId: string, weeks = 8): Promise<{ week: string; count: number }[]> {
  const today = todayISO();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("completed_at")
    .eq("student_id", studentId)
    .not("completed_at", "is", null)
    .gte("completed_at", `${addDays(today, -7 * weeks - 1)}T00:00:00Z`);
  if (error) fail("weekly workouts", error);
  const toLocal = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  return weeklyCounts(data.map((r) => toLocal.format(new Date(r.completed_at!))), today, weeks);
}

const saoPauloDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

/** São Paulo calendar dates of the student's completed workouts in the last year. */
export async function getCompletedWorkoutDates(studentId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("completed_at")
    .eq("student_id", studentId)
    .not("completed_at", "is", null)
    .gte("completed_at", `${addDays(todayISO(), -366)}T00:00:00Z`);
  if (error) fail("workout dates", error);
  return data.map((r) => saoPauloDate.format(new Date(r.completed_at!)));
}

/** Completed workouts this week (Monday–today, São Paulo) across a workspace. */
export async function getWorkspaceWeekActivity(workspaceId: string): Promise<{ workouts: number; studentsTrained: number }> {
  const today = todayISO();
  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("student_id, completed_at")
    .eq("workspace_id", workspaceId)
    .not("completed_at", "is", null)
    .gte("completed_at", `${addDays(monday, -1)}T00:00:00Z`);
  if (error) fail("week activity", error);
  const thisWeek = data.filter((r) => saoPauloDate.format(new Date(r.completed_at!)) >= monday);
  return { workouts: thisWeek.length, studentsTrained: new Set(thisWeek.map((r) => r.student_id)).size };
}

const PAGE = 1000;

/** São Paulo dates of every completed workout in a workspace since `since`, read in pages (PostgREST caps rows per call). */
export async function getWorkspaceCompletions(workspaceId: string, since: string): Promise<{ date: string; studentId: string }[]> {
  const supabase = await createClient();
  const rows: { student_id: string; completed_at: string | null }[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from("workout_logs")
      .select("student_id, completed_at")
      .eq("workspace_id", workspaceId)
      .not("completed_at", "is", null)
      .gte("completed_at", `${addDays(since, -1)}T00:00:00Z`)
      .order("completed_at")
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) fail("workspace completions", error);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows
    .map((r) => ({ date: saoPauloDate.format(new Date(r.completed_at!)), studentId: r.student_id }))
    .filter((r) => r.date >= since);
}

export type BodyProfile = { sex: Sex | null; heightCm: number | null; birthDate: string | null };

/** Sex, height and birth date kept on the student record by staff. */
export async function getBodyProfile(studentId: string): Promise<BodyProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("sex, height_cm, birth_date")
    .eq("user_id", studentId)
    .maybeSingle();
  if (error) fail("body profile", error);
  return {
    sex: data?.sex ?? null,
    heightCm: data?.height_cm == null ? null : Number(data.height_cm),
    birthDate: data?.birth_date ?? null,
  };
}

/** Latest measurement per student of a workspace: date and whether it came from a bioimpedance scale. */
export async function getLatestMeasurements(workspaceId: string): Promise<Map<string, { measuredOn: string; source: MeasurementSource }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("student_id, measured_on, source")
    .eq("workspace_id", workspaceId)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) fail("latest measurements", error);
  const latest = new Map<string, { measuredOn: string; source: MeasurementSource }>();
  for (const row of data) if (!latest.has(row.student_id)) latest.set(row.student_id, { measuredOn: row.measured_on, source: row.source });
  return latest;
}
