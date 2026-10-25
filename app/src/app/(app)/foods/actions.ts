"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { foodSchema } from "@/lib/nutrition/schemas";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { createClient } from "@/lib/supabase/server";

const DUPLICATE = "Já existe um alimento com este nome.";

function readFood(formData: FormData) {
  return Object.fromEntries(
    ["name", "basis", "kcal", "protein", "carbs", "fat", "fiber", "unitLabel", "unitAmount", "source"].map((k) => [k, formString(formData, k)]),
  ) as Record<string, string>;
}

function toRow(data: ReturnType<typeof foodSchema.parse>) {
  return {
    name: data.name,
    kcal_per_100: data.kcal,
    protein_g_per_100: data.protein,
    carbs_g_per_100: data.carbs,
    fat_g_per_100: data.fat,
    fiber_g_per_100: data.fiber,
    unit_label: data.unitLabel,
    unit_amount: data.unitAmount,
    source: data.source,
  };
}

export async function createFood(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = readFood(formData);
  const parsed = foodSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("foods")
    .insert({ ...toRow(parsed.data), basis: parsed.data.basis, workspace_id: user.workspace.id, created_by: user.id });
  if (error) return { status: "error", message: error.code === "23505" ? DUPLICATE : GENERIC_DB_ERROR, values };

  redirect("/foods");
}

export async function updateFood(foodId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = readFood(formData);
  if (!z.uuid().safeParse(foodId).success) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = foodSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  // The basis is fixed after creation: existing meal items depend on it.
  const { data, error } = await supabase
    .from("foods")
    .update(toRow(parsed.data))
    .eq("id", foodId)
    .eq("workspace_id", user.workspace.id)
    .select("id");
  if (error || !data?.length) return { status: "error", message: error?.code === "23505" ? DUPLICATE : GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Alimento atualizado. Os planos que o usam foram recalculados.", values };
}

export async function archiveFood(foodId: string): Promise<{ ok: false; message: string }> {
  const user = await requireStaff();
  if (!z.uuid().safeParse(foodId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .update({ archived: true })
    .eq("id", foodId)
    .eq("workspace_id", user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };
  redirect("/foods");
}
