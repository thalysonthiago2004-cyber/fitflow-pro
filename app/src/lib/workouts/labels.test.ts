import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { formatCardio, formatPrescription, groupSupersets, plannedUnits, repsForSet } = await import("./labels");

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
const exercise = { id: "e", name: "Esteira", muscleGroup: "cardio" as const, equipment: "machine" as const, instructions: null, videoUrl: null, videoSrc: null };

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
    const strength = { id: "s", position: 0, notes: null, exercise, kind: "strength" as const, sets: 4, repsMin: 8, repsMax: 12, repsPerSet: null, supersetGroup: null, loadKg: 60, restSeconds: 90 };
    const cardio = { id: "c", position: 1, notes: null, exercise, kind: "cardio" as const, cardio: target };
    expect(plannedUnits([strength, cardio])).toBe(5);
    expect(formatPrescription(strength)).toBe("4 × 8–12 · 60 kg · descanso 1 min 30 s");
  });
});

describe("per-set reps and supersets", () => {
  const strength = (id: string, group: string | null, repsPerSet: number[] | null = null) => ({
    id, position: 0, notes: null, exercise, kind: "strength" as const, sets: 3, repsMin: 8, repsMax: 12, repsPerSet, supersetGroup: group, loadKg: null, restSeconds: 60,
  });

  it("formats and picks each set's repetitions", () => {
    const pyramid = strength("p", null, [12, 10, 8]);
    expect(formatPrescription(pyramid)).toBe("3 × 12/10/8 · descanso 1 min");
    expect(repsForSet(pyramid, 2)).toBe("10");
    expect(repsForSet(strength("s", null), 2)).toBe("8–12");
  });

  it("groups consecutive items of the same superset only", () => {
    const blocks = groupSupersets([strength("a", "g1"), strength("b", "g1"), strength("c", null), strength("d", "g2"), strength("e", "g1")]);
    expect(blocks.map((b) => b.map((i) => i.id))).toEqual([["a", "b"], ["c"], ["d"], ["e"]]);
  });
});
