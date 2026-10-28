import { addDays, daysBetweenDates } from "@/lib/format";
import { INACTIVE_DAYS } from "./attention";

// The trainer's student list with what matters at a glance: the active plan,
// the last workout and the next session. Pure, so filters and sorting are tested.

type Student = { userId: string; fullName: string; email: string; status: "active" | "archived"; goal: string | null; joinedAt: string };

export type RosterEntry = Student & {
  activePlan: { id: string; name: string } | null;
  lastWorkout: string | null;
  workouts30: number;
  nextSession: { startsAt: string; location: string | null } | null;
};

export const ROSTER_FILTERS = ["all", "no_plan", "inactive"] as const;
export type RosterFilter = (typeof ROSTER_FILTERS)[number];
export const ROSTER_FILTER_LABELS: Record<RosterFilter, string> = {
  all: "Todos",
  no_plan: "Sem plano ativo",
  inactive: `Sem treinar há ${INACTIVE_DAYS}+ dias`,
};

export const ROSTER_SORTS = ["name", "last", "recent"] as const;
export type RosterSort = (typeof ROSTER_SORTS)[number];
export const ROSTER_SORT_LABELS: Record<RosterSort, string> = { name: "Nome (A–Z)", last: "Último treino", recent: "Entrada mais recente" };

export const parseRosterFilter = (v: unknown): RosterFilter => ((ROSTER_FILTERS as readonly string[]).includes(v as string) ? (v as RosterFilter) : "all");
export const parseRosterSort = (v: unknown): RosterSort => ((ROSTER_SORTS as readonly string[]).includes(v as string) ? (v as RosterSort) : "name");

export function buildRoster(input: {
  students: Student[];
  activePlans: { id: string; name: string; studentId: string | null; updatedAt: string }[];
  completions: { studentId: string; date: string }[];
  /** Booked sessions that have not ended yet, by start time. */
  upcoming: { studentId: string; startsAt: string; location: string | null }[];
  today: string;
}): RosterEntry[] {
  const since30 = addDays(input.today, -29);
  return input.students.map((s) => {
    const dates = input.completions.filter((c) => c.studentId === s.userId).map((c) => c.date);
    // Several active plans are possible; the most recently edited one is shown.
    const plan = input.activePlans.filter((p) => p.studentId === s.userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    const next = input.upcoming.find((a) => a.studentId === s.userId);
    return {
      ...s,
      activePlan: plan ? { id: plan.id, name: plan.name } : null,
      lastWorkout: dates.reduce<string | null>((last, d) => (last === null || d > last ? d : last), null),
      workouts30: dates.filter((d) => d >= since30).length,
      nextSession: next ? { startsAt: next.startsAt, location: next.location } : null,
    };
  });
}

/** "Never trained" counts as inactive: those students need a nudge too. */
export function isInactive(entry: RosterEntry, today: string): boolean {
  return entry.lastWorkout === null || daysBetweenDates(entry.lastWorkout, today) >= INACTIVE_DAYS;
}

export function filterRoster(entries: RosterEntry[], filter: RosterFilter, today: string): RosterEntry[] {
  if (filter === "no_plan") return entries.filter((e) => e.activePlan === null);
  if (filter === "inactive") return entries.filter((e) => isInactive(e, today));
  return entries;
}

export function sortRoster(entries: RosterEntry[], sort: RosterSort): RosterEntry[] {
  const byName = (a: RosterEntry, b: RosterEntry) => a.fullName.localeCompare(b.fullName, "pt-BR");
  return [...entries].sort((a, b) => {
    if (sort === "recent") return b.joinedAt.localeCompare(a.joinedAt) || byName(a, b);
    if (sort === "last") {
      if (a.lastWorkout !== b.lastWorkout) return a.lastWorkout === null ? 1 : b.lastWorkout === null ? -1 : b.lastWorkout.localeCompare(a.lastWorkout);
    }
    return byName(a, b);
  });
}

/** "hoje", "ontem", "há 5 dias", or null when there is no date. */
export function daysAgo(date: string | null, today: string): string | null {
  if (date === null) return null;
  const n = daysBetweenDates(date, today);
  return n <= 0 ? "hoje" : n === 1 ? "ontem" : `há ${n} dias`;
}
