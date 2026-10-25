import { describe, expect, it } from "vitest";
import { delta, estimateWorkoutKcal, personalRecords, weekStart, weeklyCounts, weeklyStreak } from "./calc";

describe("estimateWorkoutKcal", () => {
  it("applies MET × kg × hours", () => {
    expect(estimateWorkoutKcal(80, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z")).toBe(280);
    expect(estimateWorkoutKcal(70, "2026-10-20T10:00:00Z", "2026-10-20T10:45:00Z")).toBe(184);
  });
  it("refuses to estimate without weight or with implausible durations", () => {
    expect(estimateWorkoutKcal(null, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z")).toBeNull();
    expect(estimateWorkoutKcal(80, "2026-10-20T10:00:00Z", null)).toBeNull();
    expect(estimateWorkoutKcal(80, "2026-10-20T10:00:00Z", "2026-10-20T10:02:00Z")).toBeNull();
    expect(estimateWorkoutKcal(80, "2026-10-20T10:00:00Z", "2026-10-20T19:00:00Z")).toBeNull();
  });
});

describe("personalRecords", () => {
  it("keeps the heaviest set per exercise", () => {
    const records = personalRecords([
      { exerciseId: "a", exerciseName: "Supino", reps: 10, loadKg: 40, date: "2026-10-01" },
      { exerciseId: "a", exerciseName: "Supino", reps: 6, loadKg: 45, date: "2026-10-08" },
      { exerciseId: "a", exerciseName: "Supino", reps: 8, loadKg: 45, date: "2026-10-15" },
      { exerciseId: "b", exerciseName: "Agachamento", reps: 10, loadKg: null, date: "2026-10-15" },
      { exerciseId: "c", exerciseName: "Remada", reps: 12, loadKg: 30, date: "2026-10-15" },
    ]);
    expect(records).toEqual([
      { exerciseId: "c", exerciseName: "Remada", loadKg: 30, reps: 12, date: "2026-10-15" },
      { exerciseId: "a", exerciseName: "Supino", loadKg: 45, reps: 8, date: "2026-10-15" },
    ]);
  });
});

describe("weekly helpers", () => {
  it("finds Monday", () => {
    expect(weekStart("2026-10-24")).toBe("2026-10-19"); // Saturday
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday
  });
  it("buckets dates into weeks, oldest first", () => {
    const counts = weeklyCounts(["2026-10-20", "2026-10-22", "2026-10-13", "2026-01-01"], "2026-10-24", 3);
    expect(counts).toEqual([
      { week: "2026-10-05", count: 0 },
      { week: "2026-10-12", count: 1 },
      { week: "2026-10-19", count: 2 },
    ]);
  });
  it("rounds deltas", () => {
    expect(delta(71.84, 72.4)).toBe(-0.6);
    expect(delta(null, 70)).toBeNull();
  });
});

describe("weeklyStreak", () => {
  const today = "2026-10-24"; // Saturday; week starts 2026-10-19
  it("counts consecutive weeks including the current one", () => {
    expect(weeklyStreak(["2026-10-20", "2026-10-14", "2026-10-06"], today)).toBe(3);
  });
  it("keeps a streak alive when the current week has no workout yet", () => {
    expect(weeklyStreak(["2026-10-14", "2026-10-06"], today)).toBe(2);
  });
  it("breaks on a gap", () => {
    expect(weeklyStreak(["2026-10-20", "2026-09-29"], today)).toBe(1);
    expect(weeklyStreak([], today)).toBe(0);
  });
});
