import type { Prescription, StrengthPrescription } from "./queries";

// What the student does next while training. Strength blocks go set by set;
// a superset goes round by round, alternating its exercises, with the rest
// only after the last exercise of each round.

export type Step =
  | { kind: "set"; item: StrengthPrescription; index: number; restAfter: number | null }
  | { kind: "cardio"; item: Prescription };

type Done = { completed: boolean };

/** The first unfinished step from block `from` on; null when everything is done. */
export function nextStep(blocks: Prescription[][], from: number, sets: Record<string, Done[]>, cardio: Record<string, Done | undefined>): Step | null {
  if (from < 0) return null;
  for (const block of blocks.slice(from)) {
    if (block.length === 1) {
      const item = block[0];
      if (item.kind === "cardio") {
        if (!cardio[item.id]?.completed) return { kind: "cardio", item };
        continue;
      }
      const index = sets[item.id].findIndex((set) => !set.completed);
      if (index >= 0) return { kind: "set", item, index, restAfter: item.restSeconds };
      continue;
    }
    const group = block as StrengthPrescription[];
    const rounds = Math.max(...group.map((i) => i.sets));
    for (let round = 0; round < rounds; round++) {
      const inRound = group.filter((i) => i.sets > round);
      const position = inRound.findIndex((i) => !sets[i.id][round].completed);
      if (position >= 0) return { kind: "set", item: inRound[position], index: round, restAfter: position === inRound.length - 1 ? group.at(-1)!.restSeconds : null };
    }
  }
  return null;
}
