import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FoodBasis, MealItemUnit, PlanStatus } from "@/lib/supabase/database.types";
import { type FoodValues, type Nutrients, itemNutrients, sumNutrients } from "./calc";

export type Food = FoodValues & {
  id: string;
  name: string;
  unitLabel: string | null;
  source: string;
};

export type MealItem = {
  id: string;
  quantity: number;
  unit: MealItemUnit;
  notes: string | null;
  food: Food;
  nutrients: Nutrients;
};

export type Meal = {
  id: string;
  name: string;
  timeOfDay: string | null;
  notes: string | null;
  items: MealItem[];
  totals: Nutrients;
};

export type MealPlanSummary = {
  id: string;
  name: string;
  status: PlanStatus;
  studentId: string;
  studentName: string;
  updatedAt: string;
};

export type MealPlanDetail = MealPlanSummary & {
  workspaceId: string;
  notes: string | null;
  meals: Meal[];
  totals: Nutrients;
  sources: string[];
};

type FoodRow = {
  id: string;
  name: string;
  basis: FoodBasis;
  kcal_per_100: number | string;
  protein_g_per_100: number | string;
  carbs_g_per_100: number | string;
  fat_g_per_100: number | string;
  fiber_g_per_100: number | string | null;
  unit_label: string | null;
  unit_amount: number | string | null;
  source: string;
};

const FOOD_COLUMNS =
  "id, name, basis, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, fiber_g_per_100, unit_label, unit_amount, source";

const num = (v: number | string) => Number(v);
const optNum = (v: number | string | null) => (v === null ? null : Number(v));

function toFood(row: FoodRow): Food {
  return {
    id: row.id,
    name: row.name,
    basis: row.basis,
    kcalPer100: num(row.kcal_per_100),
    proteinPer100: num(row.protein_g_per_100),
    carbsPer100: num(row.carbs_g_per_100),
    fatPer100: num(row.fat_g_per_100),
    fiberPer100: optNum(row.fiber_g_per_100),
    unitLabel: row.unit_label,
    unitAmount: optNum(row.unit_amount),
    source: row.source,
  };
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`Failed to load ${what}: ${error.message}`);
}

export async function listFoods(workspaceId: string): Promise<Food[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .order("name");
  if (error) fail("foods", error);
  return data.map(toFood);
}

export async function getFood(foodId: string, workspaceId: string): Promise<Food | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("id", foodId)
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .maybeSingle();
  if (error) fail("food", error);
  return data ? toFood(data) : null;
}

async function profileNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", [...new Set(ids)]);
  if (error) fail("profiles", error);
  return new Map(data.map((p) => [p.id, p.full_name]));
}

export async function listMealPlans(filter: { workspaceId?: string; studentId?: string; statuses?: PlanStatus[] }): Promise<MealPlanSummary[]> {
  const supabase = await createClient();
  let query = supabase.from("meal_plans").select("id, name, status, student_id, updated_at").order("updated_at", { ascending: false });
  if (filter.workspaceId) query = query.eq("workspace_id", filter.workspaceId);
  if (filter.studentId) query = query.eq("student_id", filter.studentId);
  if (filter.statuses) query = query.in("status", filter.statuses);
  const { data, error } = await query;
  if (error) fail("meal plans", error);
  const names = await profileNames(data.map((p) => p.student_id));
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    studentId: p.student_id,
    studentName: names.get(p.student_id) ?? "Aluno",
    updatedAt: p.updated_at,
  }));
}

async function loadMeals(planIds: string[]): Promise<Map<string, Meal[]>> {
  const byPlan = new Map<string, Meal[]>();
  if (planIds.length === 0) return byPlan;
  const supabase = await createClient();

  const { data: meals, error } = await supabase
    .from("meals")
    .select("id, plan_id, name, time_of_day, notes, position, created_at")
    .in("plan_id", planIds)
    .order("position")
    .order("created_at");
  if (error) fail("meals", error);

  const mealIds = meals.map((m) => m.id);
  const { data: items, error: itemsError } = mealIds.length
    ? await supabase
        .from("meal_items")
        .select("id, meal_id, food_id, quantity, unit, notes, position, created_at")
        .in("meal_id", mealIds)
        .order("position")
        .order("created_at")
    : { data: [], error: null };
  if (itemsError) fail("meal items", itemsError);

  const foodIds = [...new Set(items.map((i) => i.food_id))];
  const { data: foods, error: foodsError } = foodIds.length
    ? await supabase.from("foods").select(FOOD_COLUMNS).in("id", foodIds)
    : { data: [], error: null };
  if (foodsError) fail("foods", foodsError);
  const foodById = new Map(foods.map((f) => [f.id, toFood(f)]));

  for (const meal of meals) {
    const mealItems: MealItem[] = items
      .filter((item) => item.meal_id === meal.id && foodById.has(item.food_id))
      .map((item) => {
        const food = foodById.get(item.food_id)!;
        const quantity = Number(item.quantity);
        return { id: item.id, quantity, unit: item.unit, notes: item.notes, food, nutrients: itemNutrients(quantity, item.unit, food) };
      });
    const list = byPlan.get(meal.plan_id) ?? [];
    list.push({
      id: meal.id,
      name: meal.name,
      timeOfDay: meal.time_of_day ? meal.time_of_day.slice(0, 5) : null,
      notes: meal.notes,
      items: mealItems,
      totals: sumNutrients(mealItems.map((i) => i.nutrients)),
    });
    byPlan.set(meal.plan_id, list);
  }
  return byPlan;
}

function sourcesOf(meals: Meal[]): string[] {
  return [...new Set(meals.flatMap((m) => m.items.map((i) => i.food.source.trim())))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function getMealPlan(planId: string): Promise<MealPlanDetail | null> {
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("meal_plans")
    .select("id, workspace_id, name, notes, status, student_id, updated_at")
    .eq("id", planId)
    .maybeSingle();
  if (error) fail("meal plan", error);
  if (!plan) return null;

  const [names, meals] = await Promise.all([profileNames([plan.student_id]), loadMeals([plan.id])]);
  const planMeals = meals.get(plan.id) ?? [];
  return {
    id: plan.id,
    workspaceId: plan.workspace_id,
    name: plan.name,
    notes: plan.notes,
    status: plan.status,
    studentId: plan.student_id,
    studentName: names.get(plan.student_id) ?? "Aluno",
    updatedAt: plan.updated_at,
    meals: planMeals,
    totals: sumNutrients(planMeals.map((m) => m.totals)),
    sources: sourcesOf(planMeals),
  };
}

export async function getStudentMealPlans(studentId: string): Promise<MealPlanDetail[]> {
  const plans = await listMealPlans({ studentId, statuses: ["active"] });
  const supabase = await createClient();
  const { data: notes } = plans.length
    ? await supabase.from("meal_plans").select("id, notes").in("id", plans.map((p) => p.id))
    : { data: [] as { id: string; notes: string | null }[] };
  const meals = await loadMeals(plans.map((p) => p.id));
  return plans.map((p) => {
    const planMeals = meals.get(p.id) ?? [];
    return {
      ...p,
      workspaceId: "",
      notes: notes?.find((n) => n.id === p.id)?.notes ?? null,
      meals: planMeals,
      totals: sumNutrients(planMeals.map((m) => m.totals)),
      sources: sourcesOf(planMeals),
    };
  });
}
