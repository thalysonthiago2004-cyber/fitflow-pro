// Load progression from what the student actually did. Suggestions are a
// conservative double-progression rule, presented as a hint, never applied
// automatically.

export type PastSet = { setNumber: number; reps: number | null; loadKg: number | null; completed: boolean };
export type Target = { sets: number; repsMin: number; repsMax: number | null; repsPerSet: number[] | null };

export type LastPerformance = { date: string; sets: PastSet[] };

export type Suggestion = { lastLoadKg: number; suggestedLoadKg: number } | null;

/** Top of the target for one set: its own target, or the range's maximum (or minimum when there is no range). */
export function topReps(target: Target, setNumber: number): number {
  return target.repsPerSet?.[setNumber - 1] ?? target.repsMax ?? target.repsMin;
}

/** Heaviest load used in a set that was completed. */
export function workingLoad(sets: PastSet[]): number | null {
  const loads = sets.filter((s) => s.completed && s.loadKg !== null && s.loadKg > 0).map((s) => s.loadKg!);
  return loads.length ? Math.max(...loads) : null;
}

/**
 * Suggests ~5% more load (at least 1 kg, rounded to 0.5 kg) when every
 * prescribed set was completed at the working load with reps at or above
 * the top of its target.
 */
export function suggestLoad(target: Target, last: LastPerformance | null): Suggestion {
  if (!last) return null;
  const load = workingLoad(last.sets);
  if (load === null) return null;
  for (let n = 1; n <= target.sets; n++) {
    const set = last.sets.find((s) => s.setNumber === n);
    if (!set?.completed || set.loadKg !== load || (set.reps ?? 0) < topReps(target, n)) return null;
  }
  const step = Math.max(1, Math.round(load * 0.05 * 2) / 2);
  return { lastLoadKg: load, suggestedLoadKg: Math.round((load + step) * 2) / 2 };
}

/** Best completed load per date for one exercise, oldest first (for the chart). */
export function loadHistory(sets: { date: string; loadKg: number | null }[]): { date: string; value: number }[] {
  const best = new Map<string, number>();
  for (const s of sets) {
    if (s.loadKg === null || s.loadKg <= 0) continue;
    best.set(s.date, Math.max(best.get(s.date) ?? 0, s.loadKg));
  }
  return [...best].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}
