"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { amountSchema, reminderSchema } from "@/lib/hydration/schemas";
import { formString, validationError } from "@/lib/auth/form-state";
import type { FormState } from "@/lib/auth/schemas";
import { GENERIC_DB_ERROR } from "@/lib/students/errors";
import { createClient } from "@/lib/supabase/server";

export type AddWaterResult = { ok: true; id: string } | { ok: false; message: string };

async function studentContext() {
  const user = await requireUser();
  if (user.role !== "student" || !user.workspace) redirect("/dashboard");
  return { user, workspaceId: user.workspace.id, supabase: await createClient() };
}

export async function addWater(amount: number | string): Promise<AddWaterResult> {
  const parsed = amountSchema.safeParse(amount);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { user, workspaceId, supabase } = await studentContext();

  const { data, error } = await supabase
    .from("water_logs")
    .insert({ workspace_id: workspaceId, student_id: user.id, amount_ml: parsed.data })
    .select("id")
    .single();
  if (error) return { ok: false, message: GENERIC_DB_ERROR };

  refresh();
  return { ok: true, id: data.id };
}

export async function removeWater(entryId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!z.uuid().safeParse(entryId).success) return { ok: false, message: GENERIC_DB_ERROR };
  const { user, supabase } = await studentContext();
  const { data, error } = await supabase.from("water_logs").delete().eq("id", entryId).eq("student_id", user.id).select("id");
  if (error || !data?.length) return { ok: false, message: "Só é possível remover registros de hoje." };

  refresh();
  return { ok: true };
}

export async function saveReminders(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    startTime: formString(formData, "startTime"),
    endTime: formString(formData, "endTime"),
    intervalMinutes: formString(formData, "intervalMinutes"),
  };
  const parsed = reminderSchema.safeParse({ ...values, enabled: formData.get("enabled") === "on" });
  if (!parsed.success) return validationError(parsed.error, values);
  const { user, supabase } = await studentContext();

  const row = {
    enabled: parsed.data.enabled,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    interval_minutes: parsed.data.intervalMinutes,
  };
  const { data: existing } = await supabase.from("hydration_reminders").select("student_id").eq("student_id", user.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("hydration_reminders").update(row).eq("student_id", user.id)
    : await supabase.from("hydration_reminders").insert({ student_id: user.id, ...row });
  if (error) return { status: "error", message: GENERIC_DB_ERROR, values };

  refresh();
  return { status: "success", message: parsed.data.enabled ? "Lembretes ativados." : "Lembretes desativados.", values };
}
