"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { appointmentSchema, appointmentStatusSchema } from "@/lib/schedule/schemas";
import { toInstant } from "@/lib/schedule/time";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; message: string };

const idSchema = z.uuid();

const OVERLAP = "Você já tem uma sessão nesse horário. Escolha outro horário ou cancele a outra sessão.";

function dbMessage(error: { code?: string } | null): string {
  if (error?.code === "23P01") return OVERLAP;
  if (error?.code === "23503") return "Aluno não encontrado no seu espaço.";
  return GENERIC_DB_ERROR;
}

function readForm(formData: FormData) {
  return {
    studentId: formString(formData, "studentId"),
    date: formString(formData, "date"),
    time: formString(formData, "time"),
    duration: formString(formData, "duration"),
    location: formString(formData, "location"),
    notes: formString(formData, "notes"),
  };
}

function instants(input: { date: string; time: string; duration: number }) {
  const startsAt = toInstant(input.date, input.time);
  return { starts_at: startsAt, ends_at: new Date(new Date(startsAt).getTime() + input.duration * 60000).toISOString() };
}

export async function createAppointment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = readForm(formData);
  const parsed = appointmentSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("appointments").insert({
    workspace_id: user.workspace.id,
    trainer_id: user.id,
    student_id: parsed.data.studentId,
    ...instants(parsed.data),
    location: parsed.data.location,
    notes: parsed.data.notes,
  });
  if (error) return { status: "error", message: dbMessage(error), values };

  refresh();
  return { status: "success", message: "Sessão agendada." };
}

export async function updateAppointment(appointmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const values = readForm(formData);
  if (!idSchema.safeParse(appointmentId).success) return { status: "error", message: GENERIC_DB_ERROR, values };
  const parsed = appointmentSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({ student_id: parsed.data.studentId, ...instants(parsed.data), location: parsed.data.location, notes: parsed.data.notes })
    .eq("id", appointmentId)
    .select("id");
  if (error) return { status: "error", message: dbMessage(error), values };
  if (!data.length) return { status: "error", message: "Sessão não encontrada.", values };

  refresh();
  return { status: "success", message: "Sessão atualizada." };
}

export async function setAppointmentStatus(appointmentId: string, status: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = appointmentStatusSchema.safeParse(status);
  if (!idSchema.safeParse(appointmentId).success || !parsed.success) return { ok: false, message: GENERIC_DB_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").update({ status: parsed.data }).eq("id", appointmentId).select("id");
  // Reopening a cancelled session can collide with one booked in its place.
  if (error) return { ok: false, message: dbMessage(error) };
  if (!data.length) return { ok: false, message: "Sessão não encontrada." };
  refresh();
  return { ok: true };
}

export async function deleteAppointment(appointmentId: string): Promise<ActionResult> {
  await requireStaff();
  if (!idSchema.safeParse(appointmentId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("appointments").delete().eq("id", appointmentId).select("id");
  if (error) return { ok: false, message: GENERIC_DB_ERROR };
  if (!data.length) return { ok: false, message: "Sessão não encontrada." };
  refresh();
  return { ok: true };
}
