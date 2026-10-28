import { describe, expect, it } from "vitest";
import { nextStep } from "./next-step";
import type { Prescription } from "./queries";

const exercise = { id: "e", name: "X", muscleGroup: null, equipment: null, instructions: null, videoUrl: null, videoSrc: null } as unknown as Prescription["exercise"];
const strength = (id: string, sets: number, restSeconds: number | null, supersetGroup: string | null = null): Prescription => ({
  kind: "strength", id, position: 0, notes: null, exercise: { ...exercise, name: id }, sets, repsMin: 10, repsMax: null, repsPerSet: null, supersetGroup, loadKg: null, restSeconds,
});
const cardio = (id: string): Prescription => ({ kind: "cardio", id, position: 0, notes: null, exercise: { ...exercise, name: id }, cardio: {} as never });
const marks = (n: number, done: number) => Array.from({ length: n }, (_, i) => ({ completed: i < done }));

describe("nextStep", () => {
  const squat = strength("squat", 2, 90);
  const run = cardio("run");
  const a = strength("a", 2, 30, "g");
  const b = strength("b", 3, 45, "g");
  const blocks = [[squat], [run], [a, b]];

  it("walks sets in order, then cardio", () => {
    expect(nextStep(blocks, 0, { squat: marks(2, 1), a: marks(2, 0), b: marks(3, 0) }, { run: { completed: false } })).toMatchObject({ kind: "set", item: squat, index: 1, restAfter: 90 });
    expect(nextStep(blocks, 1, { squat: marks(2, 2), a: marks(2, 0), b: marks(3, 0) }, { run: { completed: false } })).toMatchObject({ kind: "cardio", item: run });
  });

  it("alternates a superset round by round, resting only after the last exercise", () => {
    const done = { squat: marks(2, 2) };
    const ran = { run: { completed: true } };
    expect(nextStep(blocks, 2, { ...done, a: marks(2, 0), b: marks(3, 0) }, ran)).toMatchObject({ item: a, index: 0, restAfter: null });
    expect(nextStep(blocks, 2, { ...done, a: marks(2, 1), b: marks(3, 0) }, ran)).toMatchObject({ item: b, index: 0, restAfter: 45 });
    // Round 3 only has b: it is the last of that round.
    expect(nextStep(blocks, 2, { ...done, a: marks(2, 2), b: marks(3, 2) }, ran)).toMatchObject({ item: b, index: 2, restAfter: 45 });
  });

  it("is null when everything is done", () => {
    expect(nextStep(blocks, -1, {}, {})).toBeNull();
    expect(nextStep(blocks, 0, { squat: marks(2, 2), a: marks(2, 2), b: marks(3, 3) }, { run: { completed: true } })).toBeNull();
  });
});
