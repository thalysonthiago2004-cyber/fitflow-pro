import { describe, expect, it } from "vitest";
import { exerciseSchema, prescriptionSchema, sessionSchema, setLogSchema, planSchema } from "./schemas";

describe("prescriptionSchema", () => {
  it("parses Brazilian input and optional fields", () => {
    expect(
      prescriptionSchema.parse({ sets: "4", repsMin: "8", repsMax: "12", loadKg: "22,5", restSeconds: "90", notes: "" }),
    ).toEqual({ sets: 4, repsMin: 8, repsMax: 12, loadKg: 22.5, restSeconds: 90, notes: null });
    expect(prescriptionSchema.parse({ sets: "3", repsMin: "10", repsMax: "", loadKg: "", restSeconds: "", notes: "" })).toEqual({
      sets: 3,
      repsMin: 10,
      repsMax: null,
      loadKg: null,
      restSeconds: null,
      notes: null,
    });
  });

  it("rejects inverted ranges and missing sets", () => {
    const result = prescriptionSchema.safeParse({ sets: "", repsMin: "12", repsMax: "8", loadKg: "", restSeconds: "", notes: "" });
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Informe as séries.");
  });

  it("rejects max below min", () => {
    const result = prescriptionSchema.safeParse({ sets: "3", repsMin: "12", repsMax: "8", loadKg: "", restSeconds: "", notes: "" });
    expect(result.error?.issues[0]).toMatchObject({ path: ["repsMax"], message: "O máximo precisa ser maior ou igual ao mínimo." });
  });
});

describe("sessionSchema", () => {
  it("dedupes and sorts weekdays", () => {
    expect(sessionSchema.parse({ name: "Treino A", weekdays: ["5", "1", "1"] }).weekdays).toEqual([1, 5]);
  });
  it("rejects invalid weekdays", () => {
    expect(sessionSchema.safeParse({ name: "A", weekdays: ["7"] }).success).toBe(false);
  });
});

describe("exerciseSchema", () => {
  it("requires https links", () => {
    const base = { name: "Remada", muscleGroup: "back", equipment: "cable", instructions: "" };
    expect(exerciseSchema.safeParse({ ...base, videoUrl: "http://x.com" }).success).toBe(false);
    expect(exerciseSchema.parse({ ...base, videoUrl: "" }).videoUrl).toBeNull();
  });
});

describe("planSchema", () => {
  it("requires end after start", () => {
    const result = planSchema.safeParse({ name: "Plano", notes: "", startsOn: "2026-11-10", endsOn: "2026-11-01" });
    expect(result.error?.issues[0].path).toEqual(["endsOn"]);
  });
});

describe("setLogSchema", () => {
  it("accepts blank values and decimal loads", () => {
    expect(setLogSchema.parse({ reps: "", loadKg: "" })).toEqual({ reps: undefined, loadKg: undefined });
    expect(setLogSchema.parse({ reps: "10", loadKg: "12,5" })).toEqual({ reps: 10, loadKg: 12.5 });
  });
});
