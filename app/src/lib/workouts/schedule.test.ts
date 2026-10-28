import { describe, expect, it } from "vitest";
import type { Prescription } from "./queries";
import { estimateMinutes, nextPlanned, weekSchedule } from "./schedule";

const exercise = { id: "e", name: "Agachamento", muscleGroup: null, equipment: null, instructions: null, videoUrl: null, videoSrc: null } as unknown as Prescription["exercise"];
const strength = (sets: number, restSeconds: number | null): Prescription => ({
  kind: "strength", id: "s", position: 0, notes: null, exercise, sets, repsMin: 10, repsMax: null, repsPerSet: null, supersetGroup: null, loadKg: null, restSeconds,
});
const cardio = (target: Partial<Extract<Prescription, { kind: "cardio" }>["cardio"]>): Prescription => ({
  kind: "cardio", id: "c", position: 1, notes: null, exercise,
  cardio: { mode: "continuous", durationMinutes: null, distanceKm: null, intensity: null, hrMin: null, hrMax: null, speedKmh: null, inclinePct: null, rounds: null, workSeconds: null, restSeconds: null, ...target } as never,
});

describe("weekSchedule", () => {
  // 2026-10-28 is a Wednesday.
  const week = weekSchedule([{ weekdays: [1, 3] }, { weekdays: [5] }, { weekdays: [] }], ["2026-10-26", "2026-10-25"], "2026-10-28");

  it("runs Monday to Sunday", () => {
    expect(week.map((d) => d.date)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(week.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("marks planned, done, today and past days", () => {
    expect(week.filter((d) => d.planned).map((d) => d.weekday)).toEqual([1, 3, 5]);
    // Sunday 25 belongs to the previous week.
    expect(week.filter((d) => d.done).map((d) => d.date)).toEqual(["2026-10-26"]);
    expect(week.find((d) => d.isToday)?.date).toBe("2026-10-28");
    expect(week.filter((d) => d.isPast)).toHaveLength(2);
  });
});

describe("nextPlanned", () => {
  const a = { name: "A", weekdays: [1] };
  const b = { name: "B", weekdays: [4] };

  it("finds the next fixed session after today", () => {
    expect(nextPlanned([a, b], 2)).toEqual({ session: b, inDays: 2 });
    expect(nextPlanned([a, b], 5)).toEqual({ session: a, inDays: 3 });
  });

  it("wraps to the same weekday next week", () => {
    expect(nextPlanned([a], 1)).toEqual({ session: a, inDays: 7 });
  });

  it("is null without fixed days", () => {
    expect(nextPlanned([{ weekdays: [] }], 1)).toBeNull();
  });
});

describe("estimateMinutes", () => {
  it("adds sets with their rest and cardio targets, rounded to 5 minutes", () => {
    // 4 × (45 + 90) = 540 s; 3 × (45 + 60) = 315 s; 20 min = 1200 s → 2055 s ≈ 34 min → 35.
    expect(estimateMinutes([strength(4, 90), strength(3, null), cardio({ durationMinutes: 20 })])).toBe(35);
  });

  it("uses interval rounds when there is no duration", () => {
    expect(estimateMinutes([cardio({ rounds: 10, workSeconds: 30, restSeconds: 30 })])).toBe(10);
  });

  it("never goes below 5 minutes", () => {
    expect(estimateMinutes([strength(1, 0)])).toBe(5);
  });
});
