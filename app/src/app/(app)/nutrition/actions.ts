"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type StaffUser, requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { mealItemSchema, mealPlanSchema, mealSchema, newMealPlanSchema } from "@/lib/nutrition/schemas";
import { moveInList } from "@/lib/reorder";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { RATE_LIMITED, allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; message: string };

const id = z.uuid();
const UNIT_ERRORS: Record<string, string> = {
  unit_not_available: "Este alimento não tem medida caseira cadastrada. Use gramas ou ml.",
  unit_mismatch: "A unidade não combina com o alimento (sólidos em g, líquidos em ml).",
};

async function staffContext(...ids: string[]): Promise<{ user: StaffUser; supabase: Awaited<ReturnType<typeof createClient>> } | null> {
  const user = await requireStaff();
  if (!ids.every((value) => id.safeParse(value).success)) return null;
  return { user, supabase: await createClient() };
}

// Plans ----------------------------------------------------------------------

export async function createMealPlan(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = { name: formString(formData, "name"), notes: formString(formData, "notes"), studentId: formString(formData, "studentId") };
  const parsed = newMealPlanSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plans")
    .insert({ workspace_id: user.workspace.id, student_id: parsed.data.studentId, name: parsed.data.name, notes: parsed.data.notes, created_by: user.id })
    .select("id")
    .single();
  if (error) return { status: "error", message: error.code === "23503" ? "Selecione um aluno do seu espaço." : GENERIC_DB_ERROR, values };

  const defaults = [
    ["Café da manhã", "07:00"],
    ["Almoço", "12:00"],
    ["Lanche da tarde", "16:00"],
    ["Jantar", "20:00"],
  ];
  await supabase.from("meals").insert(
    defaults.map(([name, time], position) => ({ workspace_id: user.workspace.id, plan_id: data.id, name, time_of_day: time, position })),
  );
  redirect(`/nutrition/${data.id}`);
}

export async function updateMealPlan(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { name: formString(formData, "name"), notes: formString(formData, "notes") };
  const ctx = await staffContext(planId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = mealPlanSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  const { data, error } = await ctx.supabase
    .from("meal_plans")
    .update({ name: parsed.data.name, notes: parsed.data.notes })
    .eq("id", planId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values };
  refresh();
  return { status: "success", message: "Plano atualizado.", values };
}

export async function setMealPlanStatus(planId: string, status: PlanStatus): Promise<ActionResult> {
  const ctx = await staffContext(planId);
  if (!ctx || !["draft", "active", "archived"].includes(status)) return { ok: false, message: GENERIC_DB_ERROR };
  if (status === "active") {
    const { data: meals } = await ctx.supabase.from("meals").select("id").eq("plan_id", planId);
    const mealIds = meals?.map((m) => m.id) ?? [];
    const { count } = mealIds.length
      ? await ctx.supabase.from("meal_items").select("id", { count: "exact", head: true }).in("meal_id", mealIds)
      : { count: 0 };
    if (!count) return { ok: false, message: "Adicione pelo menos um alimento antes de publicar o plano." };
  }
  const { data, error } = await ctx.supabase
    .from("meal_plans")
    .update({ status })
    .eq("id", planId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  refresh();
  return { ok: true };
}

export async function deleteMealPlan(planId: string): Promise<ActionResult> {
  const ctx = await staffContext(planId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data, error } = await ctx.supabase.from("meal_plans").delete().eq("id", planId).eq("workspace_id", ctx.user.workspace.id).select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  redirect("/nutrition");
}

// Meals ----------------------------------------------------------------------

function readMeal(formData: FormData) {
  return { name: formString(formData, "name"), timeOfDay: formString(formData, "timeOfDay"), notes: formString(formData, "notes") };
}

export async function addMeal(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readMeal(formData);
  const ctx = await staffContext(planId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = mealSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  const { data: last } = await ctx.supabase.from("meals").select("position").eq("plan_id", planId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await ctx.supabase.from("meals").insert({
    workspace_id: ctx.user.workspace.id,
    plan_id: planId,
    name: parsed.data.name,
    time_of_day: parsed.data.timeOfDay,
    notes: parsed.data.notes,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values };
  refresh();
  return { status: "success", message: "Refeição adicionada." };
}

export async function updateMeal(mealId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readMeal(formData);
  const ctx = await staffContext(mealId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = mealSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  const { data, error } = await ctx.supabase
    .from("meals")
    .update({ name: parsed.data.name, time_of_day: parsed.data.timeOfDay, notes: parsed.data.notes })
    .eq("id", mealId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: GENERIC_DB_ERROR, values };
  refresh();
  return { status: "success", message: "Refeição atualizada.", values };
}

export async function deleteMeal(mealId: string): Promise<ActionResult> {
  const ctx = await staffContext(mealId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data, error } = await ctx.supabase.from("meals").delete().eq("id", mealId).eq("workspace_id", ctx.user.workspace.id).select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  refresh();
  return { ok: true };
}

export async function moveMeal(mealId: string, direction: "up" | "down"): Promise<ActionResult> {
  const ctx = await staffContext(mealId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: meal } = await ctx.supabase.from("meals").select("plan_id").eq("id", mealId).maybeSingle();
  if (!meal) return { ok: false, message: GENERIC_DB_ERROR };
  const { data: siblings } = await ctx.supabase.from("meals").select("id, position").eq("plan_id", meal.plan_id).order("position").order("created_at");
  if (!siblings || !(await moveInList(ctx.supabase, "meals", siblings, mealId, direction))) return { ok: false, message: GENERIC_DB_ERROR };
  refresh();
  return { ok: true };
}

// Meal items -----------------------------------------------------------------

function readItem(formData: FormData) {
  return { quantity: formString(formData, "quantity"), unit: formString(formData, "unit"), notes: formString(formData, "notes") };
}

export async function addMealItem(mealId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = { ...readItem(formData), foodId: formString(formData, "foodId") };
  const ctx = await staffContext(mealId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  if (!id.safeParse(values.foodId).success) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { foodId: ["Selecione um alimento."] }, values };
  }
  const parsed = mealItemSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  const { data: last } = await ctx.supabase.from("meal_items").select("position").eq("meal_id", mealId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await ctx.supabase.from("meal_items").insert({
    workspace_id: ctx.user.workspace.id,
    meal_id: mealId,
    food_id: values.foodId,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    notes: parsed.data.notes,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { status: "error", message: UNIT_ERRORS[error.message] ?? GENERIC_DB_ERROR, values };
  refresh();
  return { status: "success", message: "Alimento adicionado." };
}

export async function updateMealItem(itemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readItem(formData);
  const ctx = await staffContext(itemId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = mealItemSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);
  const { data, error } = await ctx.supabase
    .from("meal_items")
    .update({ quantity: parsed.data.quantity, unit: parsed.data.unit, notes: parsed.data.notes })
    .eq("id", itemId)
    .eq("workspace_id", ctx.user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: (error && UNIT_ERRORS[error.message]) ?? GENERIC_DB_ERROR, values };
  refresh();
  return { status: "success", message: "Alimento atualizado.", values };
}

export async function deleteMealItem(itemId: string): Promise<ActionResult> {
  const ctx = await staffContext(itemId);
  if (!ctx) return { ok: false, message: GENERIC_DB_ERROR };
  const { data, error } = await ctx.supabase.from("meal_items").delete().eq("id", itemId).eq("workspace_id", ctx.user.workspace.id).select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  refresh();
  return { ok: true };
}

/** Copies a meal plan, with its meals and foods, into a new draft for a student. */
export async function duplicateMealPlan(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const target = formString(formData, "target");
  const name = formString(formData, "name").trim();
  const values = { target, name };
  const ctx = await staffContext(planId);
  if (!ctx) return { status: "error", message: GENERIC_DB_ERROR, values };
  if (!z.uuid().safeParse(target).success) {
    return { status: "error", message: "Revise os campos destacados.", fieldErrors: { target: ["Escolha um aluno."] }, values };
  }
  if (name.length > 120) return { status: "error", message: "Revise os campos destacados.", fieldErrors: { name: ["Nome muito longo."] }, values };
  if (!(await allow(ctx.supabase, "duplicate_plan"))) return { status: "error", message: RATE_LIMITED, values };

  const { data, error } = await ctx.supabase.rpc("duplicate_meal_plan", { p_plan: planId, p_student: target, p_name: name });
  if (error || !data) return { status: "error", message: GENERIC_DB_ERROR, values };
  redirect(`/nutrition/${data}`);
}
