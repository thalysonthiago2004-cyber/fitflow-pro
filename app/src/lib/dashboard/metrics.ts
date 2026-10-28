import { addDays } from "@/lib/format";

// Trainer dashboard figures, computed from real records only. A comparison is
// shown only when the previous period has data to compare with.

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(value: unknown): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export type DateRange = { from: string; to: string };

/** The last `days` days up to today, and the same length right before it. */
export function periodRanges(today: string, days: number): { current: DateRange; previous: DateRange } {
  const from = addDays(today, -(days - 1));
  return { current: { from, to: today }, previous: { from: addDays(from, -days), to: addDays(from, -1) } };
}

export type Completion = { date: string; studentId: string };

export function summarize(completions: Completion[], range: DateRange): { workouts: number; studentsTrained: number } {
  const inRange = completions.filter((c) => c.date >= range.from && c.date <= range.to);
  return { workouts: inRange.length, studentsTrained: new Set(inRange.map((c) => c.studentId)).size };
}

/** Relative change in percent, rounded; null without a baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Share of active students who trained, 0–1; null without active students. */
export function adherence(studentsTrained: number, activeStudents: number): number | null {
  return activeStudents > 0 ? Math.min(1, studentsTrained / activeStudents) : null;
}

/** Students joined within the range (joinedAt is an ISO instant; compared by São Paulo date). */
export function joinedIn(joinedDates: string[], range: DateRange): number {
  return joinedDates.filter((d) => d >= range.from && d <= range.to).length;
}
