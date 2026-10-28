import { describe, expect, it } from "vitest";
import { adherence, joinedIn, parsePeriod, percentChange, periodRanges, summarize } from "./metrics";

describe("parsePeriod", () => {
  it("accepts 7, 30 and 90 days and defaults to 30", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("15")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
  });
});

describe("periodRanges", () => {
  it("covers the last N days including today and the N days before", () => {
    expect(periodRanges("2026-10-28", 7)).toEqual({
      current: { from: "2026-10-22", to: "2026-10-28" },
      previous: { from: "2026-10-15", to: "2026-10-21" },
    });
  });
});

describe("summarize", () => {
  const completions = [
    { date: "2026-10-20", studentId: "a" },
    { date: "2026-10-22", studentId: "a" },
    { date: "2026-10-28", studentId: "a" },
    { date: "2026-10-28", studentId: "b" },
  ];

  it("counts workouts and distinct students inside the range", () => {
    expect(summarize(completions, { from: "2026-10-22", to: "2026-10-28" })).toEqual({ workouts: 3, studentsTrained: 2 });
    expect(summarize(completions, { from: "2026-10-15", to: "2026-10-21" })).toEqual({ workouts: 1, studentsTrained: 1 });
  });
});

describe("percentChange", () => {
  it("is relative to the previous period", () => {
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, 10)).toBe(-50);
  });

  it("is null without a baseline", () => {
    expect(percentChange(5, 0)).toBeNull();
  });
});

describe("adherence", () => {
  it("is the share of active students who trained", () => {
    expect(adherence(3, 4)).toBe(0.75);
    expect(adherence(0, 0)).toBeNull();
  });
});

describe("joinedIn", () => {
  it("counts students who joined inside the range", () => {
    expect(joinedIn(["2026-10-01", "2026-10-25", "2026-10-28"], { from: "2026-10-22", to: "2026-10-28" })).toBe(2);
  });
});
