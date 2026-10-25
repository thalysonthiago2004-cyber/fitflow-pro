import "server-only";

import { addDays, todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type DayTotal = { date: string; totalMl: number };
export type WaterEntry = { id: string; amountMl: number; loggedAt: string };
export type ReminderPrefs = { enabled: boolean; startTime: string; endTime: string; intervalMinutes: number };

export const DEFAULT_REMINDERS: ReminderPrefs = { enabled: false, startTime: "08:00", endTime: "21:00", intervalMinutes: 90 };

// All reads use the caller's session; RLS limits them to the student or their staff.

export async function getCurrentGoal(studentId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hydration_goals")
    .select("daily_target_ml")
    .eq("student_id", studentId)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load hydration goal: ${error.message}`);
  return data?.daily_target_ml ?? null;
}

/** Totals for the last `days` São Paulo calendar days, oldest first, zero-filled. */
export async function getDailyTotals(studentId: string, days = 7): Promise<DayTotal[]> {
  const today = todayISO();
  const from = addDays(today, -(days - 1));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("water_logs")
    .select("local_date, amount_ml")
    .eq("student_id", studentId)
    .gte("local_date", from);
  if (error) throw new Error(`Failed to load water logs: ${error.message}`);

  const totals = new Map<string, number>();
  for (const row of data) totals.set(row.local_date, (totals.get(row.local_date) ?? 0) + row.amount_ml);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, totalMl: totals.get(date) ?? 0 };
  });
}

export async function getTodayEntries(studentId: string): Promise<WaterEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("water_logs")
    .select("id, amount_ml, logged_at")
    .eq("student_id", studentId)
    .eq("local_date", todayISO())
    .order("logged_at", { ascending: false });
  if (error) throw new Error(`Failed to load today's water logs: ${error.message}`);
  return data.map((row) => ({ id: row.id, amountMl: row.amount_ml, loggedAt: row.logged_at }));
}

export async function getReminders(studentId: string): Promise<ReminderPrefs> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hydration_reminders")
    .select("enabled, start_time, end_time, interval_minutes")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load reminders: ${error.message}`);
  if (!data) return DEFAULT_REMINDERS;
  return {
    enabled: data.enabled,
    startTime: data.start_time.slice(0, 5),
    endTime: data.end_time.slice(0, 5),
    intervalMinutes: data.interval_minutes,
  };
}
