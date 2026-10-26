"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/roles";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { PHOTO_MAX_BYTES, checkJpeg } from "@/lib/images/validate";
import { MEASUREMENT_FIELDS, measurementSchema, progressPhotoSchema } from "@/lib/progress/schemas";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { RATE_LIMITED, allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const id = z.uuid();

// The student records their own; staff record for a student of their workspace.
// Who recorded is always the signed-in user, never a form field.
export async function addMeasurement(studentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = Object.fromEntries(["measuredOn", "notes", "source", ...MEASUREMENT_FIELDS.map((f) => f.key)].map((k) => [k, formString(formData, k)]));
  const allowed = user.workspace && (user.id === studentId || isStaffRole(user.workspace.role));
  if (!id.safeParse(studentId).success || !allowed) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = measurementSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const row = Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.column, parsed.data[f.key] ?? null]));
  const { error } = await supabase.from("body_measurements").insert({
    ...row,
    workspace_id: user.workspace!.id,
    student_id: studentId,
    measured_on: parsed.data.measuredOn,
    source: parsed.data.source,
    notes: parsed.data.notes,
    recorded_by: user.id,
  });
  if (error) return { status: "error", message: error.message === "future_date" ? "A data não pode ser no futuro." : GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: "Medição registrada." };
}

export async function deleteMeasurement(measurementId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!id.safeParse(measurementId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("body_measurements").delete().eq("id", measurementId).eq("recorded_by", user.id).select("id");
  if (error || !data?.length) return { ok: false, message: "Só quem registrou a medição pode excluí-la." };
  refresh();
  return { ok: true };
}

export type PhotoResult = { ok: true } | { ok: false; message: string };

// Only the student adds photos of themselves. The file goes to their own
// folder; storage RLS and the table's checks enforce the same path.
export async function uploadProgressPhoto(formData: FormData): Promise<PhotoResult> {
  const user = await requireUser();
  if (user.role !== "student" || !user.workspace) return { ok: false, message: GENERIC_DB_ERROR };
  const parsed = progressPhotoSchema.safeParse({ takenOn: formString(formData, "takenOn"), pose: formString(formData, "pose") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const check = await checkJpeg(formData.get("photo"), PHOTO_MAX_BYTES);
  if (!check.ok) return check;

  const supabase = await createClient();
  if (!(await allow(supabase, "progress_photo"))) return { ok: false, message: RATE_LIMITED };
  const path = `${user.workspace.id}/${user.id}/${randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage.from("progress-photos").upload(path, check.file, { contentType: "image/jpeg" });
  if (uploadError) return { ok: false, message: "Não foi possível enviar a foto. Tente novamente." };

  const { error } = await supabase.from("progress_photos").insert({
    workspace_id: user.workspace.id,
    student_id: user.id,
    taken_on: parsed.data.takenOn,
    pose: parsed.data.pose,
    storage_path: path,
  });
  if (error) {
    await supabase.storage.from("progress-photos").remove([path]);
    return { ok: false, message: error.message === "future_date" ? "A data não pode ser no futuro." : GENERIC_DB_ERROR };
  }

  refresh();
  return { ok: true };
}

export async function deleteProgressPhoto(photoId: string): Promise<PhotoResult> {
  const user = await requireUser();
  if (!id.safeParse(photoId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("progress_photos").delete().eq("id", photoId).eq("student_id", user.id).select("storage_path");
  if (error || !data?.length) return { ok: false, message: "Só o aluno pode excluir as próprias fotos." };
  await supabase.storage.from("progress-photos").remove([data[0].storage_path]);
  refresh();
  return { ok: true };
}
