import { addDays } from "@/lib/format";
import { weekStart } from "@/lib/progress/calc";

// Sessions are booked in São Paulo time. Brazil has had no daylight saving
// since 2019, so a fixed -03:00 offset turns a local date and time into an
// instant without a time-zone database.
const OFFSET = "-03:00";
const TIME_ZONE = "America/Sao_Paulo";

const dateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TIME_ZONE });

/** "2026-10-28" + "07:30" (São Paulo) → ISO instant. */
export function toInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00${OFFSET}`).toISOString();
}

/** São Paulo calendar date (YYYY-MM-DD) of an instant. */
export const localDate = (iso: string) => dateFormat.format(new Date(iso));

/** São Paulo wall time (HH:MM) of an instant. */
export const localTime = (iso: string) => timeFormat.format(new Date(iso));

/** Monday–Sunday dates of the week containing `date`. */
export function weekDates(date: string): string[] {
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Instants bounding São Paulo days [from, to] inclusive, for range queries. */
export function dayBounds(from: string, to: string): { start: string; end: string } {
  return { start: toInstant(from, "00:00"), end: toInstant(addDays(to, 1), "00:00") };
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

/** 45 → "45 min"; 90 → "1 h 30 min"; 120 → "2 h". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
