"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type StaffUser, requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { moveInList } from "@/lib/reorder";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { newPlanSchema, planSchema, prescriptionSchema, sessionSchema } from "@/lib/workouts/schemas";

export type ActionResult = { ok: true } | { ok: false; message: string };

const id = z.uuid();
const HAS_HISTORY = "Já existem treinos registrados aqui. Para preservar o histórico do aluno, arquive o plano em vez de excluir.";

function readPlan(formData: FormData) {
  return {
    name: formString(formData, "name"),
    notes: formString(formData, "notes"),
    startsOn: formString(formData, "startsOn"),
    endsOn: formString(formData, "endsOn"),
  };
}

function readPrescription(formData: FormData) {
  return {
    sets: formString(formData, "sets"),
    repsMin: formString(formData, "repsMin"),
    repsMax: formString(formData, "repsMax"),
    loadKg: formString(formData, "loadKg"),
    restSeconds: formString(formData, "restSeconds"),
    notes: formString(formData, "notes"),
  };
}

async function staffContext(...ids: string[]): Promise<{ user: StaffUser; supabase: Awaited<ReturnType<typeof createClient>> } | null> {
  const user = await requireStaff();
  if (!ids.every((value) => id.safeParse(value).success)) return null;
  return { user, supabase: await createClient() };
}

// Plans -----------------------------------------------------------------------

export async function createPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = { ...readPlan(formData), studentId: formString(formData, "studentId") };
  const parsed = newPlanSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_plans")
    .insert({
      workspace_id: user.workspace.id,
      student_id: parsed.data.studentId,
      name: parsed.data.name,
      notes: parsed.data.notes,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      created_by: user.id,
    })
    .select("id")
    .single();
  // A foreign-key failure means the student is not in this workspace.
  if (error) return { status: "error", message: error.code === "23503" ? "Selecione um aluno do seu espaço." : GENERIC_DB_ERROR, values };

  // Start with a first session so the builder is immediately usable.
  await supabase.from("workout_sessions").insert({ workspace_id: user.workspace.id, plan_id: data.id, name: "Treino A" });
  redirect(`/workouts/${data.id}`);
}

export async function updatePlan(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readPlan(formData);
  const ctx = await staffContext(planId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = planSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { data, error } = await ctx.supabase
    .from("workout_plans")
    .update({ name: parsed.data.name, notes: parsed.data.notes, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn })
    .eq("id", planId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Plano atualizado.", values };
}

export async function setPlanStatus(planId: string, status: PlanStatus): Promise<ActionResult> {
  const ctx = await staffContext(planId);
  if (!ctx || !["draft", "active", "archived"].includes(status)) return { ok: false, message: GENERIC_DB_ERROR };

  if (status === "active") {
    const { data: sessions } = await ctx.supabase.from("workout_sessions").select("id").eq("plan_id", planId);
    const sessionIds = sessions?.map((s) => s.id) ?? [];
    const { count } = sessionIds.length
      ? await ctx.supabase.from("session_exercises").select("id", { count: "exact", head: true }).in("session_id", sessionIds)
      : { count: 0 };
    if (!count) return { ok: false, message: "Adicione pelo menos um exercício antes de publicar o plano." };
  }

  const { data, error } = await ctx.supabase
    .from("workout_plans")
    .update({ status })
    .eq("id", planId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };

  refresh();
  return { ok: true };
}

async function hasLogs(column: "plan_id" | "session_id", value: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { count } = await supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq(column, value);
  return (count ?? 0) > 0;
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const ctx = await staffContext(planId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  if (await hasLogs("plan_id", planId, ctx.supabase)) return { ok: false, message: HAS_HISTORY };

  const { data, error } = await ctx.supabase
    .from("workout_plans")
    .delete()
    .eq("id", planId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };

  redirect("/workouts");
}

// Sessions --------------------------------------------------------------------

function readSession(formData: FormData) {
  return { name: formString(formData, "name"), weekdays: formData.getAll("weekdays").map(String) };
}

export async function addSession(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readSession(formData);
  const values = { name: raw.name };
  const ctx = await staffContext(planId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const { data: last } = await ctx.supabase
    .from("workout_sessions")
    .select("position")
    .eq("plan_id", planId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await ctx.supabase.from("workout_sessions").insert({
    workspace_id: ctx.user.workspace.id,
    plan_id: planId,
    name: parsed.data.name,
    weekdays: parsed.data.weekdays,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Treino adicionado." };
}

export async function updateSession(sessionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readSession(formData);
  const values = { name: raw.name };
  const ctx = await staffContext(sessionId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const { data, error } = await ctx.supabase
    .from("workout_sessions")
    .update({ name: parsed.data.name, weekdays: parsed.data.weekdays })
    .eq("id", sessionId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Treino atualizado.", values };
}

export async function deleteSession(sessionId: string): Promise<ActionResult> {
  const ctx = await staffContext(sessionId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  if (await hasLogs("session_id", sessionId, ctx.supabase)) return { ok: false, message: HAS_HISTORY };

  const { data, error } = await ctx.supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };

  refresh();
  return { ok: true };
}

export async function moveSession(sessionId: string, direction: "up" | "down"): Promise<ActionResult> {
  const ctx = await staffContext(sessionId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: session } = await ctx.supabase.from("workout_sessions").select("plan_id").eq("id", sessionId).maybeSingle();
  if (!session) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: siblings } = await ctx.supabase
    .from("workout_sessions")
    .select("id, position")
    .eq("plan_id", session.plan_id)
    .order("position")
    .order("created_at");
  if (!siblings || !(await moveInList(ctx.supabase, "workout_sessions", siblings, sessionId, direction))) {
    return { ok: false, message: GENERIC_DB_ERROR };
  }
  refresh();
  return { ok: true };
}

// Prescribed exercises --------------------------------------------------------

export async function addPrescription(sessionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { ...readPrescription(formData), exerciseId: formString(formData, "exerciseId") };
  const ctx = await staffContext(sessionId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  if (!id.safeParse(values.exerciseId).success) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { exerciseId: ["Selecione um exercício."] }, values };
  }
  const parsed = prescriptionSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { data: last } = await ctx.supabase
    .from("session_exercises")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await ctx.supabase.from("session_exercises").insert({
    workspace_id: ctx.user.workspace.id,
    session_id: sessionId,
    exercise_id: values.exerciseId,
    position: (last?.position ?? -1) + 1,
    sets: parsed.data.sets,
    reps_min: parsed.data.repsMin,
    reps_max: parsed.data.repsMax,
    load_kg: parsed.data.loadKg,
    rest_seconds: parsed.data.restSeconds,
    notes: parsed.data.notes,
  });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Exercício adicionado." };
}

export async function updatePrescription(itemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readPrescription(formData);
  const ctx = await staffContext(itemId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = prescriptionSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { data, error } = await ctx.supabase
    .from("session_exercises")
    .update({
      sets: parsed.data.sets,
      reps_min: parsed.data.repsMin,
      reps_max: parsed.data.repsMax,
      load_kg: parsed.data.loadKg,
      rest_seconds: parsed.data.restSeconds,
      notes: parsed.data.notes,
    })
    .eq("id", itemId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Exercício atualizado.", values };
}

export async function deletePrescription(itemId: string): Promise<ActionResult> {
  const ctx = await staffContext(itemId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { count } = await ctx.supabase.from("set_logs").select("id", { count: "exact", head: true }).eq("session_exercise_id", itemId);
  if (count) return { ok: false, message: HAS_HISTORY };

  const { data, error } = await ctx.supabase
    .from("session_exercises")
    .delete()
    .eq("id", itemId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };

  refresh();
  return { ok: true };
}

export async function movePrescription(itemId: string, direction: "up" | "down"): Promise<ActionResult> {
  const ctx = await staffContext(itemId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: item } = await ctx.supabase.from("session_exercises").select("session_id").eq("id", itemId).maybeSingle();
  if (!item) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: siblings } = await ctx.supabase
    .from("session_exercises")
    .select("id, position")
    .eq("session_id", item.session_id)
    .order("position")
    .order("created_at");
  if (!siblings || !(await moveInList(ctx.supabase, "session_exercises", siblings, itemId, direction))) {
    return { ok: false, message: GENERIC_DB_ERROR };
  }
  refresh();
  return { ok: true };
}
