"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { ReminderPrefs } from "@/lib/hydration/queries";

const LAST_KEY = "fitflow:last-water-reminder";

function minutesNowInSaoPaulo(): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" })
    .format(new Date())
    .split(":")
    .map(Number);
  return h * 60 + m;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function readLast(): number {
  try {
    return Number(localStorage.getItem(LAST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLast(value: number) {
  try {
    localStorage.setItem(LAST_KEY, String(value));
  } catch {
    // Storage can be unavailable (private mode); reminders still fire per session.
  }
}

// In-app hydration reminders. Runs only while the app is open; background push
// would need Web Push (VAPID keys + a server scheduler), which is not set up.
export function ReminderRunner({ prefs, goalReached }: { prefs: ReminderPrefs; goalReached: boolean }) {
  useEffect(() => {
    if (!prefs.enabled || goalReached) return;
    let lastInSession = readLast();

    function tick() {
      const now = minutesNowInSaoPaulo();
      if (now < toMinutes(prefs.startTime) || now > toMinutes(prefs.endTime)) return;
      if (Date.now() - lastInSession < prefs.intervalMinutes * 60_000) return;
      lastInSession = Date.now();
      writeLast(lastInSession);

      const message = "Hora de beber água. Registre no FitFlow Pro para acompanhar sua meta.";
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        new Notification("FitFlow Pro", { body: message, icon: "/icon.svg", tag: "water-reminder" });
      } else {
        toast(message, { id: "water-reminder" });
      }
    }

    // First check waits one interval from the last reminder; then every minute.
    if (!lastInSession) {
      lastInSession = Date.now();
      writeLast(lastInSession);
    }
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [prefs, goalReached]);

  return null;
}
