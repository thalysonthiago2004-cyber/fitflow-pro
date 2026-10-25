import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { formatCardio, formatPrescription, plannedUnits } = await import("./labels");

const target = {
  mode: "continuous" as const,
  durationMinutes: 30,
  distanceKm: 5,
  intensity: "moderate" as const,
  hrMin: 130,
  hrMax: 150,
  speedKmh: null,
  inclinePct: 2,
  rounds: null,
  workSeconds: null,
  restSeconds: null,
};
const exercise = { id: "e", name: "Esteira", muscleGroup: "cardio" as const, equipment: "machine" as const, instructions: null, videoUrl: null };

describe("formatCardio", () => {
  it("summarizes continuous cardio", () => {
    expect(formatCardio(target)).toBe("30 min · 5 km · moderada · FC 130–150 bpm · inclinação 2%");
  });
  it("summarizes intervals", () => {
    expect(formatCardio({ ...target, mode: "intervals", rounds: 8, workSeconds: 60, restSeconds: 90, durationMinutes: null, distanceKm: null, hrMin: null, hrMax: null, inclinePct: null, intensity: "vigorous" })).toBe(
      "8 × 1 min, descanso 1 min 30 s · intensa",
    );
  });
});

describe("plannedUnits", () => {
  it("counts strength sets and one unit per cardio block", () => {
    const strength = { id: "s", position: 0, notes: null, exercise, kind: "strength" as const, sets: 4, repsMin: 8, repsMax: 12, loadKg: 60, restSeconds: 90 };
    const cardio = { id: "c", position: 1, notes: null, exercise, kind: "cardio" as const, cardio: target };
    expect(plannedUnits([strength, cardio])).toBe(5);
    expect(formatPrescription(strength)).toBe("4 × 8–12 · 60 kg · descanso 1 min 30 s");
  });
});
