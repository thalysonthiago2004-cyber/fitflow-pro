"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { pushConfigured, sendPush } from "@/lib/push/server";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };
const FAILED = "Não foi possível salvar. Tente novamente.";

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Stores this device's push subscription for the signed-in user. */
export async function savePushSubscription(input: unknown): Promise<Result> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: FAILED };
  const supabase = await createClient();
  // Re-subscribing the same device replaces the old row (endpoint is unique).
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
  });
  return error ? { ok: false, message: FAILED } : { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { ok: false, message: FAILED } : { ok: true };
}

/** A test notification to every device of the signed-in user. */
export async function sendTestPush(): Promise<Result> {
  const user = await requireUser();
  if (!pushConfigured()) return { ok: false, message: "As notificações ainda não estão configuradas no servidor." };
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user.id);
  if (!data?.length) return { ok: false, message: "Ative as notificações neste aparelho primeiro." };
  const results = await Promise.all(data.map((s) => sendPush(s, { title: "FitFlow Pro", body: "Notificações ativadas. Você vai receber seus lembretes por aqui.", tag: "test" })));
  return results.includes("sent") ? { ok: true } : { ok: false, message: "O aparelho não recebeu a notificação. Tente ativar de novo." };
}

const timeSchema = z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):(00|30)$/)]);

/** Daily "workout today" reminder (São Paulo time); empty turns it off. */
export async function saveWorkoutReminder(time: string): Promise<Result> {
  const user = await requireUser();
  const parsed = timeSchema.safeParse(time);
  if (!parsed.success) return { ok: false, message: FAILED };
  const supabase = await createClient();
  const value = parsed.data || null;
  const { data: existing } = await supabase.from("notification_preferences").select("user_id").eq("user_id", user.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("notification_preferences").update({ workout_reminder_time: value }).eq("user_id", user.id)
    : await supabase.from("notification_preferences").insert({ user_id: user.id, workout_reminder_time: value });
  if (error) return { ok: false, message: FAILED };
  refresh();
  return { ok: true };
}

/** Trainers: pushes about students' finished workouts, comments and questionnaires. */
export async function saveActivityAlerts(enabled: boolean): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("notification_preferences").select("user_id").eq("user_id", user.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("notification_preferences").update({ activity_alerts: enabled === true }).eq("user_id", user.id)
    : await supabase.from("notification_preferences").insert({ user_id: user.id, activity_alerts: enabled === true });
  if (error) return { ok: false, message: FAILED };
  refresh();
  return { ok: true };
}
