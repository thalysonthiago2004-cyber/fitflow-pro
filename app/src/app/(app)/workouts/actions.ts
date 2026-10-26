"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type StaffUser, requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { moveInList } from "@/lib/reorder";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { RATE_LIMITED, allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { cardioSchema, newPlanSchema, planSchema, prescriptionSchema, sessionSchema } from "@/lib/workouts/schemas";
import { STARTER_TEMPLATES, starterExerciseNames } from "@/lib/workouts/starter-templates";

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
    repsMode: formString(formData, "repsMode"),
    repsPerSet: formData.getAll("repsPerSet").map(String).join(","),
    loadKg: formString(formData, "loadKg"),
    restSeconds: formString(formData, "restSeconds"),
    notes: formString(formData, "notes"),
  };
}

const CARDIO_FIELDS = ["cardioMode", "durationMinutes", "distanceKm", "rounds", "workSeconds", "restSeconds", "intensity", "hrMin", "hrMax", "speedKmh", "inclinePct", "notes"] as const;

function readCardio(formData: FormData) {
  return Object.fromEntries(CARDIO_FIELDS.map((key) => [key, formString(formData, key)]));
}

function cardioColumns(data: ReturnType<typeof cardioSchema.parse>) {
  return {
    cardio_mode: data.cardioMode,
    duration_minutes: data.durationMinutes,
    distance_km: data.distanceKm,
    rounds: data.rounds,
    work_seconds: data.workSeconds,
    rest_seconds: data.restSeconds,
    intensity: data.intensity,
    hr_min: data.hrMin,
    hr_max: data.hrMax,
    speed_kmh: data.speedKmh,
    incline_pct: data.inclinePct,
    notes: data.notes,
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
    reps_per_set: parsed.data.repsPerSet,
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
      reps_per_set: parsed.data.repsPerSet,
      load_kg: parsed.data.loadKg,
      rest_seconds: parsed.data.restSeconds,
      notes: parsed.data.notes,
    })
    .eq("id", itemId)
    .eq("workspace_id", ctx.user.workspace.id)
    .eq("kind", "strength")
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Exercício atualizado.", values };
}

// Cardio -----------------------------------------------------------------------
// The database derives the item's kind from the exercise; checking the muscle
// group first only turns a constraint error into a clear message.

export async function addCardio(sessionId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { ...readCardio(formData), exerciseId: formString(formData, "exerciseId") };
  const ctx = await staffContext(sessionId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const pickError = { status: "error" as const, message: "Revise os campos destacados.", fieldErrors: { exerciseId: ["Selecione uma atividade de cardio."] }, values };
  if (!id.safeParse(values.exerciseId).success) return pickError;
  const parsed = cardioSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { data: exercise } = await ctx.supabase.from("exercises").select("muscle_group").eq("id", values.exerciseId).maybeSingle();
  if (exercise?.muscle_group !== "cardio") return pickError;

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
    ...cardioColumns(parsed.data),
  });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Cardio adicionado." };
}

export async function updateCardio(itemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readCardio(formData);
  const ctx = await staffContext(itemId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = cardioSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const { data, error } = await ctx.supabase
    .from("session_exercises")
    .update(cardioColumns(parsed.data))
    .eq("id", itemId)
    .eq("workspace_id", ctx.user.workspace.id)
    .eq("kind", "cardio")
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Cardio atualizado.", values };
}

export async function deletePrescription(itemId: string): Promise<ActionResult> {
  const ctx = await staffContext(itemId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const [{ count: sets }, { count: cardio }] = await Promise.all([
    ctx.supabase.from("set_logs").select("id", { count: "exact", head: true }).eq("session_exercise_id", itemId),
    ctx.supabase.from("cardio_logs").select("id", { count: "exact", head: true }).eq("session_exercise_id", itemId),
  ]);
  if (sets || cardio) return { ok: false, message: HAS_HISTORY };

  const { data, error } = await ctx.supabase
    .from("session_exercises")
    .delete()
    .eq("id", itemId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id, session_id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };

  await tidySupersets(ctx.supabase, data[0].session_id);
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
  await tidySupersets(ctx.supabase, item.session_id);
  refresh();
  return { ok: true };
}

// Supersets -------------------------------------------------------------------
// A superset is a run of consecutive items sharing a group id. After any
// reorder or removal, items left alone in their group are released.

async function tidySupersets(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string) {
  const { data: items } = await supabase
    .from("session_exercises")
    .select("id, superset_group")
    .eq("session_id", sessionId)
    .order("position")
    .order("created_at");
  if (!items) return;
  const alone = items.filter(
    (item, i) => item.superset_group && items[i - 1]?.superset_group !== item.superset_group && items[i + 1]?.superset_group !== item.superset_group,
  );
  if (alone.length) await supabase.from("session_exercises").update({ superset_group: null }).in("id", alone.map((i) => i.id));
}

/** Joins an exercise to the one right above it, forming or extending a bi-set/tri-set. */
export async function joinPrevious(itemId: string): Promise<ActionResult> {
  const ctx = await staffContext(itemId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: item } = await ctx.supabase.from("session_exercises").select("session_id").eq("id", itemId).maybeSingle();
  if (!item) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: items } = await ctx.supabase
    .from("session_exercises")
    .select("id, kind, superset_group")
    .eq("session_id", item.session_id)
    .order("position")
    .order("created_at");
  const index = items?.findIndex((i) => i.id === itemId) ?? -1;
  const previous = index > 0 ? items![index - 1] : undefined;
  if (!previous || items![index].kind !== "strength" || previous.kind !== "strength") {
    return { ok: false, message: "Só exercícios de musculação seguidos podem formar um bi-set." };
  }
  const group = previous.superset_group ?? items![index].superset_group ?? randomUUID();
  const { error } = await ctx.supabase
    .from("session_exercises")
    .update({ superset_group: group })
    .in("id", [previous.id, itemId])
    .eq("workspace_id", ctx.user.workspace.id);
  if (error) return { ok: false, message: GENERIC_DB_ERROR };
  await tidySupersets(ctx.supabase, item.session_id);
  refresh();
  return { ok: true };
}

/** Takes an exercise out of its superset. */
export async function leaveSuperset(itemId: string): Promise<ActionResult> {
  const ctx = await staffContext(itemId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data, error } = await ctx.supabase
    .from("session_exercises")
    .update({ superset_group: null })
    .eq("id", itemId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("session_id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  await tidySupersets(ctx.supabase, data[0].session_id);
  refresh();
  return { ok: true };
}

// Templates and duplication ------------------------------------------------------

/** Copies a plan or template into a new draft for a student, or into a new template. */
export async function duplicatePlan(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const target = formString(formData, "target");
  const name = formString(formData, "name").trim();
  const values = { target, name };
  const ctx = await staffContext(planId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  if (target !== "template" && !id.safeParse(target).success) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { target: ["Escolha um aluno ou salve como modelo."] }, values };
  }
  if (name.length > 120) return { status: "error", message: "Revise os campos destacados.", fieldErrors: { name: ["Nome muito longo."] }, values };

  if (!(await allow(ctx.supabase, "duplicate_plan"))) return { status: "error", message: RATE_LIMITED, values };
  const { data, error } = await ctx.supabase.rpc("duplicate_workout_plan", {
    p_plan: planId,
    // Generated RPC types mark every argument as non-null; null makes a template.
    p_student: (target === "template" ? null : target) as string,
    p_name: name,
  });
  if (error || !data) return { status: "error", message: GENERIC_DB_ERROR, values };
  redirect(`/workouts/${data}`);
}

/**
 * Adds the starter templates the workspace does not have yet. Everything is
 * written with the trainer's session (RLS applies) and exercises come from the
 * global catalog by name.
 */
export async function addStarterTemplates(): Promise<ActionResult & { added?: number }> {
  const user = await requireStaff();
  const supabase = await createClient();
  if (!(await allow(supabase, "duplicate_plan"))) return { ok: false, message: RATE_LIMITED };

  const [{ data: existing }, { data: catalog }] = await Promise.all([
    supabase.from("workout_plans").select("name").eq("workspace_id", user.workspace.id).eq("is_template", true),
    supabase.from("exercises").select("id, name").is("workspace_id", null).in("name", starterExerciseNames()),
  ]);
  const have = new Set((existing ?? []).map((p) => p.name));
  const exerciseId = new Map((catalog ?? []).map((e) => [e.name, e.id]));
  const missing = STARTER_TEMPLATES.filter((t) => !have.has(t.name));
  if (missing.some((t) => t.sessions.some((s) => s.items.some((i) => !exerciseId.has(i.exercise))))) return { ok: false, message: GENERIC_DB_ERROR };

  for (const template of missing) {
    const { data: plan, error } = await supabase
      .from("workout_plans")
      .insert({ workspace_id: user.workspace.id, student_id: null, is_template: true, status: "draft", name: template.name, notes: template.notes, created_by: user.id })
      .select("id")
      .single();
    if (error || !plan) return { ok: false, message: GENERIC_DB_ERROR };
    for (const [sessionIndex, session] of template.sessions.entries()) {
      const { data: row, error: sessionError } = await supabase
        .from("workout_sessions")
        .insert({ workspace_id: user.workspace.id, plan_id: plan.id, name: session.name, weekdays: session.weekdays, position: sessionIndex })
        .select("id")
        .single();
      if (sessionError || !row) return { ok: false, message: GENERIC_DB_ERROR };
      const groups = new Map<string, string>();
      const items = session.items.map((item, position) => {
        const base = { workspace_id: user.workspace.id, session_id: row.id, exercise_id: exerciseId.get(item.exercise)!, position };
        if ("cardio" in item) {
          return item.cardio === "continuous"
            ? { ...base, cardio_mode: "continuous" as const, duration_minutes: item.minutes, intensity: item.intensity }
            : { ...base, cardio_mode: "intervals" as const, rounds: item.rounds, work_seconds: item.work, rest_seconds: item.rest, intensity: item.intensity };
        }
        if (item.group && !groups.has(item.group)) groups.set(item.group, randomUUID());
        return {
          ...base,
          sets: item.sets,
          reps_min: item.reps[0],
          reps_max: item.reps[1] !== null && item.reps[1] !== item.reps[0] ? item.reps[1] : null,
          rest_seconds: item.rest,
          superset_group: item.group ? groups.get(item.group)! : null,
        };
      });
      const { error: itemsError } = await supabase.from("session_exercises").insert(items);
      if (itemsError) return { ok: false, message: GENERIC_DB_ERROR };
    }
  }
  refresh();
  return { ok: true, added: missing.length };
}
