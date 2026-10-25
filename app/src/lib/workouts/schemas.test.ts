import { describe, expect, it } from "vitest";
import { cardioLogSchema, cardioSchema, exerciseSchema, prescriptionSchema, sessionSchema, setLogSchema, planSchema } from "./schemas";

describe("prescriptionSchema", () => {
  it("parses Brazilian input and optional fields", () => {
    expect(
      prescriptionSchema.parse({ sets: "4", repsMin: "8", repsMax: "12", loadKg: "22,5", restSeconds: "90", notes: "" }),
    ).toEqual({ sets: 4, repsMin: 8, repsMax: 12, repsPerSet: null, loadKg: 22.5, restSeconds: 90, notes: null });
    expect(prescriptionSchema.parse({ sets: "3", repsMin: "10", repsMax: "", loadKg: "", restSeconds: "", notes: "" })).toEqual({
      sets: 3,
      repsMin: 10,
      repsMax: null,
      repsPerSet: null,
      loadKg: null,
      restSeconds: null,
      notes: null,
    });
  });

  it("takes one repetition target per set", () => {
    const base = { sets: "3", repsMode: "perSet", loadKg: "", restSeconds: "", notes: "" };
    expect(prescriptionSchema.parse({ ...base, repsPerSet: "12,10,8" })).toMatchObject({ repsPerSet: [12, 10, 8], repsMin: 8, repsMax: 12 });
    expect(prescriptionSchema.safeParse({ ...base, repsPerSet: "12,10" }).error?.issues[0]).toMatchObject({
      path: ["repsPerSet"],
      message: "Escolha as repetições de cada série (entre 1 e 100).",
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

describe("cardioSchema", () => {
  const blank = { cardioMode: "continuous", durationMinutes: "", distanceKm: "", rounds: "", workSeconds: "", restSeconds: "", intensity: "", hrMin: "", hrMax: "", speedKmh: "", inclinePct: "", notes: "" };

  it("accepts continuous cardio and drops interval fields", () => {
    expect(cardioSchema.parse({ ...blank, durationMinutes: "30", distanceKm: "4,5", rounds: "8", intensity: "moderate" })).toMatchObject({
      durationMinutes: 30,
      distanceKm: 4.5,
      rounds: null,
      intensity: "moderate",
    });
  });

  it("requires duration or distance for continuous, rounds and work for intervals", () => {
    expect(cardioSchema.safeParse(blank).error?.issues[0].message).toBe("Informe a duração ou a distância.");
    const messages = cardioSchema.safeParse({ ...blank, cardioMode: "intervals" }).error?.issues.map((i) => i.message);
    expect(messages).toEqual(["Informe quantas séries.", "Informe o tempo de estímulo."]);
  });

  it("keeps the heart-rate range ordered", () => {
    expect(cardioSchema.safeParse({ ...blank, durationMinutes: "20", hrMin: "150", hrMax: "130" }).error?.issues[0].message).toBe(
      "A máxima precisa ser maior ou igual à mínima.",
    );
  });
});

describe("cardioLogSchema", () => {
  it("parses decimal commas and bounds effort", () => {
    expect(cardioLogSchema.parse({ durationMinutes: "28,5", distanceKm: "4,2", avgHr: "", rpe: "6", roundsDone: "" })).toEqual({
      durationMinutes: 28.5,
      distanceKm: 4.2,
      avgHr: undefined,
      rpe: 6,
      roundsDone: undefined,
    });
    expect(cardioLogSchema.safeParse({ rpe: "11" }).success).toBe(false);
  });
});
