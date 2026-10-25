"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { createClient } from "@/lib/supabase/server";
import { exerciseSchema } from "@/lib/workouts/schemas";

const DUPLICATE = "Já existe um exercício com este nome na sua biblioteca.";

function readExercise(formData: FormData) {
  return {
    name: formString(formData, "name"),
    muscleGroup: formString(formData, "muscleGroup"),
    equipment: formString(formData, "equipment"),
    instructions: formString(formData, "instructions"),
    videoUrl: formString(formData, "videoUrl"),
  };
}

export async function createExercise(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = readExercise(formData);
  const parsed = exerciseSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      workspace_id: user.workspace.id,
      name: parsed.data.name,
      muscle_group: parsed.data.muscleGroup,
      equipment: parsed.data.equipment,
      instructions: parsed.data.instructions,
      video_url: parsed.data.videoUrl,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: error.code === "23505" ? DUPLICATE : GENERIC_DB_ERROR, values };

  redirect(`/exercises/${data.id}`);
}

export async function updateExercise(exerciseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = readExercise(formData);
  if (!z.uuid().safeParse(exerciseId).success) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = exerciseSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({
      name: parsed.data.name,
      muscle_group: parsed.data.muscleGroup,
      equipment: parsed.data.equipment,
      instructions: parsed.data.instructions,
      video_url: parsed.data.videoUrl,
    })
    .eq("id", exerciseId)
    .eq("workspace_id", user.workspace.id)
    .select("id");
  if (error || !data?.length) {
    return { status: "error", message: error?.code === "23505" ? DUPLICATE : GENERIC_DB_ERROR, values };
  }

  refresh();
  return { status: "success", message: "Exercício atualizado.", values };
}

// Archiving keeps the exercise inside existing plans and logs, but hides it
// from the library and from new prescriptions.
export async function archiveExercise(exerciseId: string): Promise<{ ok: false; message: string }> {
  const user = await requireStaff();
  if (!z.uuid().safeParse(exerciseId).success) return { ok: false, message: GENERIC_DB_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({ archived: true })
    .eq("id", exerciseId)
    .eq("workspace_id", user.workspace.id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: GENERIC_DB_ERROR };

  redirect("/exercises");
}
