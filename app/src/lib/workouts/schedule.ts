import { addDays } from "@/lib/format";
import { weekStart } from "@/lib/progress/calc";
import type { Prescription } from "./queries";

type Scheduled = { weekdays: number[] };

export type WeekDay = {
  date: string;
  /** 0 = Sunday, as in Date#getDay. */
  weekday: number;
  /** A session is fixed on this weekday. */
  planned: boolean;
  /** At least one workout was completed on this date. */
  done: boolean;
  isToday: boolean;
  isPast: boolean;
};

/** Monday–Sunday of the week of `today`, with planned and completed days. */
export function weekSchedule(sessions: Scheduled[], doneDates: string[], today: string): WeekDay[] {
  const planned = new Set(sessions.flatMap((s) => s.weekdays));
  const done = new Set(doneDates);
  const monday = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const weekday = (i + 1) % 7;
    return { date, weekday, planned: planned.has(weekday), done: done.has(date), isToday: date === today, isPast: date < today };
  });
}

/** The first session fixed on a day after `today` (1–7 days ahead). */
export function nextPlanned<T extends Scheduled>(sessions: T[], today: number): { session: T; inDays: number } | null {
  for (let inDays = 1; inDays <= 7; inDays++) {
    const session = sessions.find((s) => s.weekdays.includes((today + inDays) % 7));
    if (session) return { session, inDays };
  }
  return null;
}

// Rough time per set (execution + setup) and default rest when none is set.
const SET_SECONDS = 45;
const DEFAULT_REST_SECONDS = 60;
const DEFAULT_CARDIO_MINUTES = 10;

/** Estimated session length in minutes, from sets, rest and cardio targets. */
export function estimateMinutes(exercises: Prescription[]): number {
  const seconds = exercises.reduce((sum, item) => {
    if (item.kind === "strength") return sum + item.sets * (SET_SECONDS + (item.restSeconds ?? DEFAULT_REST_SECONDS));
    const c = item.cardio;
    if (c.durationMinutes) return sum + c.durationMinutes * 60;
    if (c.rounds && c.workSeconds) return sum + c.rounds * (c.workSeconds + (c.restSeconds ?? 0));
    return sum + DEFAULT_CARDIO_MINUTES * 60;
  }, 0);
  return Math.max(5, Math.round(seconds / 300) * 5);
}
