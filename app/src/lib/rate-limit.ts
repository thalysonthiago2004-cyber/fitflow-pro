import "server-only";

import type { createClient } from "@/lib/supabase/server";

// Limits per signed-in user, per fixed window. Generous for real use; they only
// stop scripted abuse (thousands of invitations, comments or uploads).
const LIMITS = {
  invite: { max: 30, windowSeconds: 3600 },
  comment: { max: 60, windowSeconds: 3600 },
  progress_photo: { max: 30, windowSeconds: 3600 },
  avatar: { max: 10, windowSeconds: 3600 },
  exercise_video: { max: 20, windowSeconds: 3600 },
  data_export: { max: 10, windowSeconds: 3600 },
  push_test: { max: 10, windowSeconds: 3600 },
  taco_import: { max: 20, windowSeconds: 3600 },
  questionnaire: { max: 10, windowSeconds: 3600 },
  duplicate_plan: { max: 30, windowSeconds: 3600 },
  // Each question is a paid model call: 30 per day (UTC day).
  assistant: { max: 30, windowSeconds: 86400 },
} as const;

export type LimitedAction = keyof typeof LIMITS;
export const RATE_LIMITED = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Counts one attempt and says whether it is allowed. If the check itself
 * fails, the action proceeds (the error is logged by the client): a database
 * hiccup should not lock people out. Paid actions pass `failClosed` instead.
 */
export async function allow(supabase: Client, action: LimitedAction, { failClosed = false } = {}): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[action];
  const { data, error } = await supabase.rpc("check_rate_limit", { p_action: action, p_max: max, p_window_seconds: windowSeconds });
  return error ? !failClosed : data !== false;
}
