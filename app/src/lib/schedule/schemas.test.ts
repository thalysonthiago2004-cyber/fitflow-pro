import { describe, expect, it } from "vitest";
import { addDays, todayISO } from "@/lib/format";
import { appointmentSchema } from "./schemas";

const base = { studentId: "00000000-0000-4000-8000-000000000001", date: addDays(todayISO(), 1), time: "07:30", duration: "60", location: "", notes: "" };

describe("appointmentSchema", () => {
  it("accepts a valid booking and empties optional text", () => {
    expect(appointmentSchema.parse(base)).toMatchObject({ duration: 60, location: null, notes: null });
  });

  it("rejects impossible dates and times", () => {
    expect(appointmentSchema.safeParse({ ...base, date: "2026-02-31" }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...base, time: "24:00" }).success).toBe(false);
  });

  it("rejects dates far in the past or future, and odd durations", () => {
    expect(appointmentSchema.safeParse({ ...base, date: addDays(todayISO(), -61) }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...base, date: addDays(todayISO(), 400) }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...base, duration: "10" }).success).toBe(false);
    expect(appointmentSchema.safeParse({ ...base, duration: "600" }).success).toBe(false);
  });
});
