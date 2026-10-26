import { timingSafeEqual } from "node:crypto";
import { pushConfigured, sendPush } from "@/lib/push/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called every 15 minutes by the database scheduler (pg_cron + pg_net).
// The database decides what is due and records each delivery once; this
// handler only sends the notifications and forgets dead subscriptions.

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const LINKS: Record<string, string> = { water: "/hydration", workout: "/training" };

export async function POST(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  if (!pushConfigured()) return Response.json({ sent: 0, reason: "push not configured" });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_due_reminders");
  if (error) return Response.json({ error: "claim failed" }, { status: 500 });

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    data.map(async (r) => {
      const result = await sendPush(r, { title: r.title, body: r.body, url: LINKS[r.kind] ?? "/dashboard", tag: r.kind });
      if (result === "sent") sent++;
      if (result === "gone") gone.push(r.endpoint);
    }),
  );
  if (gone.length) await supabase.from("push_subscriptions").delete().in("endpoint", gone);
  return Response.json({ claimed: data.length, sent, removed: gone.length });
}
