import { describe, expect, it } from "vitest";
import { type Clock, advance } from "./interval-timer";

const start: Clock = { phase: "work", round: 1, endsAt: 0, pausedLeft: null, now: 0 };

describe("advance", () => {
  it("alternates work and rest, then finishes after the last work phase", () => {
    let c = start;
    const phases: string[] = [];
    for (let i = 0; i < 5; i++) {
      c = advance(c, 3, 30, 60, i * 1000);
      phases.push(`${c.phase}${c.round}`);
    }
    expect(phases).toEqual(["rest1", "work2", "rest2", "work3", "done3"]);
  });

  it("skips rest when there is none", () => {
    expect(advance(start, 3, 30, 0, 0)).toMatchObject({ phase: "work", round: 2, endsAt: 30_000 });
  });
});
