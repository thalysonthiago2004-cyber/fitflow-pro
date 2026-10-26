import "server-only";

import webpush from "web-push";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;

/** True when VAPID keys are set; without them push is simply unavailable. */
export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://fitflow-pro.vercel.app"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/** Sends one notification. Returns "gone" when the browser dropped the subscription. */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"sent" | "gone" | "failed"> {
  configure();
  try {
    await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), { TTL: 60 * 60 });
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}
