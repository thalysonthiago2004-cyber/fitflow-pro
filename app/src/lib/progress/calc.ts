// Derived progress values. Everything here is calculated from recorded data
// and must be presented as such (estimates are labeled in the UI).

/**
 * MET for "resistance (weight) training, multiple exercises, 8–15 repetitions
 * at varied resistance" — Compendium of Physical Activities (Ainsworth et al.,
 * 2011), code 02054.
 */
export const RESISTANCE_TRAINING_MET = 3.5;

export type CardioBlock = { minutes: number; met: number };

/**
 * kcal ≈ MET × body weight (kg) × duration (h). Cardio blocks use their own
 * MET for their recorded minutes; the rest of the session counts as
 * resistance training. Null when inputs are missing or implausible.
 */
export function estimateWorkoutKcal(weightKg: number | null, startedAt: string, completedAt: string | null, cardio: CardioBlock[] = []): number | null {
  if (weightKg === null || completedAt === null) return null;
  const hours = (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 3_600_000;
  // Sessions shorter than 5 min or longer than 4 h are likely left open by mistake.
  if (hours < 5 / 60 || hours > 4) return null;
  // Recorded cardio cannot exceed the session itself.
  const cardioHours = Math.min(hours, cardio.reduce((sum, c) => sum + c.minutes, 0) / 60);
  const scale = cardio.length && cardioHours > 0 ? cardioHours / (cardio.reduce((sum, c) => sum + c.minutes, 0) / 60) : 1;
  const cardioKcal = cardio.reduce((sum, c) => sum + c.met * weightKg * (c.minutes / 60) * scale, 0);
  return Math.round(RESISTANCE_TRAINING_MET * weightKg * (hours - cardioHours) + cardioKcal);
}

export type LoggedSet = {
  exerciseId: string;
  exerciseName: string;
  reps: number | null;
  loadKg: number | null;
  date: string;
};

export type PersonalRecord = { exerciseId: string; exerciseName: string; loadKg: number; reps: number | null; date: string };

/** Heaviest completed set per exercise; ties go to more reps, then the earliest date. */
export function personalRecords(sets: LoggedSet[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const set of sets) {
    if (set.loadKg === null || set.loadKg <= 0) continue;
    const current = best.get(set.exerciseId);
    const better =
      !current ||
      set.loadKg > current.loadKg ||
      (set.loadKg === current.loadKg && (set.reps ?? 0) > (current.reps ?? 0)) ||
      (set.loadKg === current.loadKg && (set.reps ?? 0) === (current.reps ?? 0) && set.date < current.date);
    if (better) best.set(set.exerciseId, { exerciseId: set.exerciseId, exerciseName: set.exerciseName, loadKg: set.loadKg, reps: set.reps, date: set.date });
  }
  return [...best.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, "pt-BR"));
}

/** Monday (YYYY-MM-DD) of the week containing `date`. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

/** Counts per week for the `weeks` weeks ending with the week of `today`, oldest first. */
export function weeklyCounts(dates: string[], today: string, weeks: number): { week: string; count: number }[] {
  const last = weekStart(today);
  const result = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(`${last}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * (weeks - 1 - i));
    return { week: d.toISOString().slice(0, 10), count: 0 };
  });
  const index = new Map(result.map((r, i) => [r.week, i]));
  for (const date of dates) {
    const i = index.get(weekStart(date));
    if (i !== undefined) result[i].count += 1;
  }
  return result;
}

export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 10) / 10;
}

/** Consecutive weeks with at least one completed workout, counting back from
 *  the current week (or the previous one, so an untrained current week does
 *  not break a streak that is still alive). */
export function weeklyStreak(dates: string[], today: string): number {
  const weeks = new Set(dates.map(weekStart));
  const step = (week: string) => {
    const d = new Date(`${week}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  };
  let cursor = weekStart(today);
  if (!weeks.has(cursor)) cursor = step(cursor);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = step(cursor);
  }
  return streak;
}
