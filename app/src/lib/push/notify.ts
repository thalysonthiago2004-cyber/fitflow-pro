import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { type PushPayload, pushConfigured, sendPush } from "./server";

// Pushes about activity between a student and their trainer. Recipients are
// derived on the server from the record that changed (never from the client),
// and anyone who turned activity alerts off is skipped. Runs inside after(),
// so failures never affect the action that triggered it.

export type ActivityEvent =
  | { type: "workout_completed"; logId: string }
  | { type: "comment"; logId: string; authorId: string }
  | { type: "questionnaire"; workspaceId: string; studentId: string; needsClearance: boolean };

type Db = ReturnType<typeof createAdminClient>;

async function staffOf(db: Db, workspaceId: string): Promise<string[]> {
  const { data } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).in("role", ["owner", "trainer"]);
  return (data ?? []).map((m) => m.user_id);
}

async function firstName(db: Db, userId: string): Promise<string> {
  const { data } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name.split(/\s+/)[0] ?? "Seu aluno";
}

async function deliver(db: Db, userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return;
  const { data: off } = await db.from("notification_preferences").select("user_id").in("user_id", userIds).eq("activity_alerts", false);
  const muted = new Set((off ?? []).map((p) => p.user_id));
  const recipients = userIds.filter((id) => !muted.has(id));
  if (recipients.length === 0) return;
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", recipients);
  const gone: string[] = [];
  await Promise.all((subs ?? []).map(async (s) => ((await sendPush(s, payload)) === "gone" ? gone.push(s.endpoint) : null)));
  if (gone.length) await db.from("push_subscriptions").delete().in("endpoint", gone);
}

export async function notifyActivity(event: ActivityEvent): Promise<void> {
  if (!pushConfigured() || !process.env.SUPABASE_SECRET_KEY) return;
  try {
    const db = createAdminClient();
    if (event.type === "questionnaire") {
      const name = await firstName(db, event.studentId);
      await deliver(db, await staffOf(db, event.workspaceId), {
        title: event.needsClearance ? "Anamnese pede atenção" : "Anamnese respondida",
        body: event.needsClearance ? `${name} respondeu "sim" no PAR-Q: recomenda-se liberação médica.` : `${name} respondeu a anamnese.`,
        url: `/students/${event.studentId}`,
        tag: `parq-${event.studentId}`,
      });
      return;
    }

    const { data: log } = await db.from("workout_logs").select("id, workspace_id, student_id, workout_sessions(name)").eq("id", event.logId).maybeSingle();
    if (!log) return;
    const session = log.workout_sessions?.name ?? "treino";
    const name = await firstName(db, log.student_id);
    const trainerUrl = `/students/${log.student_id}/logs/${log.id}`;

    if (event.type === "workout_completed") {
      await deliver(db, await staffOf(db, log.workspace_id), { title: "Treino concluído", body: `${name} concluiu ${session}.`, url: trainerUrl, tag: `log-${log.id}` });
      return;
    }
    const fromStudent = event.authorId === log.student_id;
    await deliver(db, fromStudent ? await staffOf(db, log.workspace_id) : [log.student_id], {
      title: fromStudent ? `${name} comentou` : "Seu personal comentou",
      body: `No ${session}. Toque para ver.`,
      url: fromStudent ? trainerUrl : `/training/log/${log.id}`,
      tag: `comment-${log.id}`,
    });
  } catch (error) {
    console.error("[notify]", event.type, error instanceof Error ? error.message : "unknown error");
  }
}
