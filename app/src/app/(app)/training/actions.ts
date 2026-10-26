"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { formString } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { notifyActivity } from "@/lib/push/notify";
import { createClient } from "@/lib/supabase/server";
import { cardioLogSchema, setLogSchema } from "@/lib/workouts/schemas";

export type ActionResult = { ok: true } | { ok: false; message: string };

const id = z.uuid();

// Only the student records their own workouts. RLS enforces it as well; the
// checks here give clear messages and keep requests well-formed.
async function studentContext() {
  const user = await requireUser();
  if (user.role !== "student") redirect("/dashboard");
  return { user, supabase: await createClient() };
}

export async function startWorkout(sessionId: string): Promise<ActionResult> {
  if (!id.safeParse(sessionId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const { user, supabase } = await studentContext();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select("id, plan_id, workspace_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, message: "Treino não encontrado." };

  const { data, error } = await supabase
    .from("workout_logs")
    .insert({ workspace_id: session.workspace_id, student_id: user.id, plan_id: session.plan_id, session_id: session.id })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: open } = await supabase.from("workout_logs").select("id").eq("student_id", user.id).is("completed_at", null).maybeSingle();
    if (open) redirect(`/training/log/${open.id}`);
  }
  if (error || !data) {
    return { ok: false, message: "Não foi possível iniciar o treino. Verifique se o plano ainda está ativo." };
  }
  redirect(`/training/log/${data.id}`);
}

type SetInput = { logId: string; sessionExerciseId: string; setNumber: number; reps: string; loadKg: string; completed: boolean };

export async function saveSet(input: SetInput): Promise<ActionResult> {
  if (!id.safeParse(input.logId).success || !id.safeParse(input.sessionExerciseId).success) {
    return { ok: false, message: GENERIC_DB_ERROR };
  }
  if (!Number.isInteger(input.setNumber) || input.setNumber < 1 || input.setNumber > 20) {
    return { ok: false, message: GENERIC_DB_ERROR };
  }
  const parsed = setLogSchema.safeParse({ reps: input.reps, loadKg: input.loadKg });
  if (!parsed.success) return { ok: false, message: "Confira as repetições e a carga informadas." };

  const { supabase } = await studentContext();
  const { data: log } = await supabase.from("workout_logs").select("completed_at").eq("id", input.logId).maybeSingle();
  if (!log) return { ok: false, message: GENERIC_DB_ERROR };
  if (log.completed_at) return { ok: false, message: "Este treino já foi concluído." };

  const values = {
    reps: parsed.data.reps ?? null,
    load_kg: parsed.data.loadKg ?? null,
    completed: input.completed,
  };
  const { data: existing } = await supabase
    .from("set_logs")
    .select("id")
    .eq("log_id", input.logId)
    .eq("session_exercise_id", input.sessionExerciseId)
    .eq("set_number", input.setNumber)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("set_logs").update(values).eq("id", existing.id)
    : await supabase.from("set_logs").insert({
        log_id: input.logId,
        session_exercise_id: input.sessionExerciseId,
        set_number: input.setNumber,
        ...values,
      });
  if (error) return { ok: false, message: GENERIC_DB_ERROR };
  return { ok: true };
}

type CardioInput = {
  logId: string;
  sessionExerciseId: string;
  durationMinutes: string;
  distanceKm: string;
  avgHr: string;
  rpe: string;
  roundsDone: string;
  completed: boolean;
};

export async function saveCardio(input: CardioInput): Promise<ActionResult> {
  if (!id.safeParse(input.logId).success || !id.safeParse(input.sessionExerciseId).success) {
    return { ok: false, message: GENERIC_DB_ERROR };
  }
  const parsed = cardioLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { supabase } = await studentContext();
  const { data: log } = await supabase.from("workout_logs").select("completed_at").eq("id", input.logId).maybeSingle();
  if (!log) return { ok: false, message: GENERIC_DB_ERROR };
  if (log.completed_at) return { ok: false, message: "Este treino já foi concluído." };

  const values = {
    duration_minutes: parsed.data.durationMinutes ?? null,
    distance_km: parsed.data.distanceKm ?? null,
    avg_hr: parsed.data.avgHr ?? null,
    rpe: parsed.data.rpe ?? null,
    rounds_done: parsed.data.roundsDone ?? null,
    completed: input.completed,
  };
  const { data: existing } = await supabase
    .from("cardio_logs")
    .select("id")
    .eq("log_id", input.logId)
    .eq("session_exercise_id", input.sessionExerciseId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("cardio_logs").update(values).eq("id", existing.id)
    : await supabase.from("cardio_logs").insert({ log_id: input.logId, session_exercise_id: input.sessionExerciseId, ...values });
  if (error) return { ok: false, message: GENERIC_DB_ERROR };
  return { ok: true };
}

export async function finishWorkout(logId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const notes = formString(formData, "notes").trim();
  if (!id.safeParse(logId).success) return { status: "error", message: GENERIC_DB_ERROR };
  if (notes.length > 1000) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { notes: ["Use no máximo 1000 caracteres."] }, values: { notes } };
  }

  const { user, supabase } = await studentContext();
  const { data, error } = await supabase
    .from("workout_logs")
    .update({ completed_at: new Date().toISOString(), notes: notes || null })
    .eq("id", logId)
    .eq("student_id", user.id)
    .is("completed_at", null)
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values: { notes } };

  after(() => notifyActivity({ type: "workout_completed", logId }));
  refresh();
  redirect(`/training/log/${logId}`);
}

export async function discardWorkout(logId: string): Promise<ActionResult> {
  if (!id.safeParse(logId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const { user, supabase } = await studentContext();
  const { data, error } = await supabase
    .from("workout_logs")
    .delete()
    .eq("id", logId)
    .eq("student_id", user.id)
    .is("completed_at", null)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  redirect("/training");
}
