"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/dal";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { getPublicEnv } from "@/lib/env";
import { dbErrorMessage } from "@/lib/students/errors";
import { goalSchema } from "@/lib/hydration/schemas";
import { inviteStudentSchema, studentProfileSchema } from "@/lib/students/schemas";
import { RATE_LIMITED, allow } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type InviteState = FormState & { inviteUrl?: string; expiresAt?: string };
export type ActionResult = { ok: true; inviteUrl?: string; expiresAt?: string } | { ok: false; message: string };

const idSchema = z.uuid();

function inviteUrl(token: string) {
  return new URL(`/invite/${token}`, getPublicEnv().NEXT_PUBLIC_SITE_URL).toString();
}

export async function inviteStudent(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const user = await requireStaff();
  const values = { fullName: formString(formData, "fullName"), email: formString(formData, "email") };
  const parsed = inviteStudentSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  if (!(await allow(supabase, "invite"))) return { status: "error", message: RATE_LIMITED, values };
  const { data, error } = await supabase.rpc("create_student_invitation", {
    p_workspace_id: user.workspace.id,
    p_email: parsed.data.email,
    p_full_name: parsed.data.fullName,
  });
  const grant = data?.[0];
  if (error || !grant) return { status: "error", message: dbErrorMessage(error), values };

  refresh();
  return {
    status: "success",
    message: `Convite criado para ${parsed.data.fullName}.`,
    inviteUrl: inviteUrl(grant.token),
    expiresAt: grant.expires_at,
  };
}

export async function refreshInvitation(invitationId: string): Promise<ActionResult> {
  await requireStaff();
  if (!idSchema.safeParse(invitationId).success) return { ok: false, message: dbErrorMessage(null) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("refresh_student_invitation", { p_invitation_id: invitationId });
  const grant = data?.[0];
  if (error || !grant) return { ok: false, message: dbErrorMessage(error) };

  refresh();
  return { ok: true, inviteUrl: inviteUrl(grant.token), expiresAt: grant.expires_at };
}

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  await requireStaff();
  if (!idSchema.safeParse(invitationId).success) return { ok: false, message: dbErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_student_invitation", { p_invitation_id: invitationId });
  if (error) return { ok: false, message: dbErrorMessage(error) };

  refresh();
  return { ok: true };
}

export async function updateStudentProfile(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();
  const values = {
    goal: formString(formData, "goal"),
    experienceLevel: formString(formData, "experienceLevel"),
    sex: formString(formData, "sex"),
    birthDate: formString(formData, "birthDate"),
    heightCm: formString(formData, "heightCm"),
    limitations: formString(formData, "limitations"),
  };
  if (!idSchema.safeParse(studentId).success) return { status: "error", message: dbErrorMessage(null), values };
  const parsed = studentProfileSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({
      goal: parsed.data.goal,
      experience_level: parsed.data.experienceLevel,
      sex: parsed.data.sex,
      birth_date: parsed.data.birthDate,
      height_cm: parsed.data.heightCm,
      limitations: parsed.data.limitations,
    })
    .eq("workspace_id", user.workspace.id)
    .eq("user_id", studentId)
    .select("user_id");
  if (error || !data?.length) return { status: "error", message: dbErrorMessage(error), values };

  refresh();
  return { status: "success", message: "Dados do aluno salvos.", values };
}

export async function setStudentStatus(studentId: string, status: "active" | "archived"): Promise<ActionResult> {
  const user = await requireStaff();
  if (!idSchema.safeParse(studentId).success || !["active", "archived"].includes(status)) {
    return { ok: false, message: dbErrorMessage(null) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ status })
    .eq("workspace_id", user.workspace.id)
    .eq("user_id", studentId)
    .select("user_id");
  if (error || !data?.length) return { ok: false, message: dbErrorMessage(error) };

  refresh();
  return { ok: true };
}

export async function removeStudent(studentId: string): Promise<ActionResult> {
  const user = await requireStaff();
  if (!idSchema.safeParse(studentId).success) return { ok: false, message: dbErrorMessage(null) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_student", {
    p_workspace_id: user.workspace.id,
    p_user_id: studentId,
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };

  redirect("/students");
}

// Goals are kept as history: each change inserts a new row.
export async function setHydrationGoal(studentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const values = { liters: formString(formData, "liters") };
  if (!idSchema.safeParse(studentId).success) return { status: "error", message: dbErrorMessage(null), values };
  const parsed = goalSchema.safeParse(values);
  if (!parsed.success) return validationError(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("hydration_goals").insert({
    workspace_id: user.workspace.id,
    student_id: studentId,
    daily_target_ml: parsed.data.dailyTargetMl,
    set_by: user.id,
  });
  if (error) return { status: "error", message: dbErrorMessage(error), values };

  refresh();
  return { status: "success", message: "Meta de hidratação salva.", values };
}
