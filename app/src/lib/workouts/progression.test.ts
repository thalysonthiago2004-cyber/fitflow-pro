import { describe, expect, it } from "vitest";
import { loadHistory, suggestLoad } from "./progression";

const target = { sets: 3, repsMin: 8, repsMax: 12, repsPerSet: null };
const sets = (reps: number[], load = 40) => reps.map((r, i) => ({ setNumber: i + 1, reps: r, loadKg: load, completed: true }));

describe("suggestLoad", () => {
  it("suggests ~5% more when every set hit the top of the range", () => {
    expect(suggestLoad(target, { date: "2026-10-20", sets: sets([12, 12, 13]) })).toEqual({ lastLoadKg: 40, suggestedLoadKg: 42 });
    expect(suggestLoad(target, { date: "2026-10-20", sets: sets([12, 12, 12], 100) })?.suggestedLoadKg).toBe(105);
  });

  it("uses at least 1 kg for light loads", () => {
    expect(suggestLoad(target, { date: "d", sets: sets([12, 12, 12], 6) })?.suggestedLoadKg).toBe(7);
  });

  it("does not suggest when a set fell short, was skipped or used another load", () => {
    expect(suggestLoad(target, { date: "d", sets: sets([12, 11, 12]) })).toBeNull();
    expect(suggestLoad(target, { date: "d", sets: sets([12, 12]) })).toBeNull();
    expect(suggestLoad(target, { date: "d", sets: [...sets([12, 12]), { setNumber: 3, reps: 12, loadKg: 35, completed: true }] })).toBeNull();
    expect(suggestLoad(target, null)).toBeNull();
  });

  it("respects per-set targets", () => {
    const pyramid = { sets: 3, repsMin: 8, repsMax: 12, repsPerSet: [12, 10, 8] };
    expect(suggestLoad(pyramid, { date: "d", sets: sets([12, 10, 8]) })?.suggestedLoadKg).toBe(42);
    expect(suggestLoad(pyramid, { date: "d", sets: sets([12, 9, 8]) })).toBeNull();
  });
});

describe("loadHistory", () => {
  it("keeps the best load per day, oldest first", () => {
    expect(loadHistory([{ date: "2026-10-02", loadKg: 40 }, { date: "2026-10-01", loadKg: 37.5 }, { date: "2026-10-02", loadKg: 42.5 }, { date: "2026-10-03", loadKg: null }])).toEqual([
      { date: "2026-10-01", value: 37.5 },
      { date: "2026-10-02", value: 42.5 },
    ]);
  });
});
