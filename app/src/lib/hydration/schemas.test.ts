import { describe, expect, it } from "vitest";
import { amountSchema, goalSchema, reminderSchema } from "./schemas";

describe("hydration schemas", () => {
  it("converts liters with a decimal comma to ml", () => {
    expect(goalSchema.parse({ liters: "2,5" })).toEqual({ dailyTargetMl: 2500 });
    expect(goalSchema.safeParse({ liters: "15" }).success).toBe(false);
    expect(goalSchema.safeParse({ liters: "" }).success).toBe(false);
  });

  it("bounds single intakes", () => {
    expect(amountSchema.parse("250")).toBe(250);
    expect(amountSchema.safeParse("0").success).toBe(false);
    expect(amountSchema.safeParse("12.5").success).toBe(false);
  });

  it("validates reminder windows", () => {
    const base = { enabled: true, startTime: "08:00", endTime: "21:00", intervalMinutes: "90" };
    expect(reminderSchema.parse(base).intervalMinutes).toBe(90);
    expect(reminderSchema.safeParse({ ...base, endTime: "07:00" }).success).toBe(false);
    expect(reminderSchema.safeParse({ ...base, intervalMinutes: "17" }).success).toBe(false);
  });
});
