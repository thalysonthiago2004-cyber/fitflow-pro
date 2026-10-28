import { getCurrentUser } from "@/lib/auth/dal";
import { RATE_LIMITED, allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// LGPD access/portability: everything the signed-in user can see about
// themselves, as JSON. Every query runs with the user's session, so RLS
// limits the export to data they are allowed to read.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const supabase = await createClient();
  if (!(await allow(supabase, "data_export"))) return new Response(RATE_LIMITED, { status: 429 });
  const own = <T>(result: { data: T | null }) => result.data ?? [];

  const common = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    consents: own(await supabase.from("consents").select("document, version, accepted_at")),
    workspace: user.workspace,
  };

  let data: Record<string, unknown>;
  if (user.role === "student") {
    const [student, measurements, photos, logs, water, goals, questionnaires, comments, appointments] = await Promise.all([
      supabase.from("students").select("goal, experience_level, sex, birth_date, height_cm, limitations, joined_at").eq("user_id", user.id),
      supabase.from("body_measurements").select("*").eq("student_id", user.id).order("measured_on"),
      supabase.from("progress_photos").select("taken_on, pose, storage_path, created_at").eq("student_id", user.id),
      supabase.from("workout_logs").select("id, started_at, completed_at, notes, set_logs(set_number, reps, load_kg, completed), cardio_logs(duration_minutes, distance_km, avg_hr, rpe, rounds_done, completed)").eq("student_id", user.id).order("started_at"),
      supabase.from("water_logs").select("amount_ml, logged_at").eq("student_id", user.id).order("logged_at"),
      supabase.from("hydration_goals").select("*").eq("student_id", user.id),
      supabase.from("health_questionnaires").select("*").eq("student_id", user.id),
      supabase.from("workout_comments").select("log_id, body, created_at").eq("author_id", user.id),
      supabase.from("appointments").select("starts_at, ends_at, status, location, notes").eq("student_id", user.id).order("starts_at"),
    ]);
    data = {
      ...common,
      profile: own(student)[0] ?? null,
      measurements: own(measurements),
      progressPhotos: own(photos),
      workouts: own(logs),
      water: own(water),
      hydrationGoals: own(goals),
      healthQuestionnaires: own(questionnaires),
      comments: own(comments),
      appointments: own(appointments),
    };
  } else {
    const workspaceId = user.workspace?.id ?? "";
    const [students, plans, exercises, customizations, foods, appointments] = await Promise.all([
      supabase.from("students").select("user_id, email, status, goal, joined_at").eq("workspace_id", workspaceId),
      supabase.from("workout_plans").select("name, status, starts_on, ends_on, workout_sessions(name, weekdays, session_exercises(*))").eq("workspace_id", workspaceId),
      supabase.from("exercises").select("*").eq("workspace_id", workspaceId),
      supabase.from("exercise_customizations").select("*").eq("workspace_id", workspaceId),
      supabase.from("foods").select("*").eq("workspace_id", workspaceId),
      supabase.from("appointments").select("student_id, starts_at, ends_at, status, location, notes").eq("trainer_id", user.id).order("starts_at"),
    ]);
    data = {
      ...common,
      students: own(students),
      workoutPlans: own(plans),
      exercises: own(exercises),
      exerciseCustomizations: own(customizations),
      foods: own(foods),
      appointments: own(appointments),
    };
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="fitflow-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
