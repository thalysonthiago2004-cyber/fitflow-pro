import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES, starterExerciseNames } from "./starter-templates";
import { cardioSchema, prescriptionSchema } from "./schemas";

// Global catalog names and their muscle groups, read from the migrations.
const sql = readdirSync(join(__dirname, "../../../supabase/migrations")).map((f) => readFileSync(join(__dirname, "../../../supabase/migrations", f), "utf8")).join("\n");
const catalog = new Map([...sql.matchAll(/\(null, '([^']+)', '([a-z_]+)'/g)].map((m) => [m[1], m[2]]));

describe("starter templates", () => {
  it("use only exercises from the global catalog, cardio only for cardio items", () => {
    for (const name of starterExerciseNames()) expect(catalog.has(name), name).toBe(true);
    for (const t of STARTER_TEMPLATES)
      for (const s of t.sessions)
        for (const item of s.items) expect(catalog.get(item.exercise) === "cardio", item.exercise).toBe("cardio" in item);
  });

  it("pass the same validation as a trainer's own prescriptions", () => {
    for (const item of STARTER_TEMPLATES.flatMap((t) => t.sessions.flatMap((s) => s.items))) {
      if ("cardio" in item) {
        const blank = { durationMinutes: "", distanceKm: "", rounds: "", workSeconds: "", restSeconds: "", hrMin: "", hrMax: "", speedKmh: "", inclinePct: "", notes: "" };
        const parsed = cardioSchema.safeParse(
          item.cardio === "continuous"
            ? { ...blank, cardioMode: "continuous", durationMinutes: String(item.minutes), intensity: item.intensity }
            : { ...blank, cardioMode: "intervals", rounds: String(item.rounds), workSeconds: String(item.work), restSeconds: String(item.rest), intensity: item.intensity },
        );
        expect(parsed.success, item.exercise).toBe(true);
      } else {
        const parsed = prescriptionSchema.safeParse({ sets: String(item.sets), repsMin: String(item.reps[0]), repsMax: item.reps[1] === null ? "" : String(item.reps[1]), restSeconds: String(item.rest), loadKg: "", notes: "" });
        expect(parsed.success, item.exercise).toBe(true);
      }
    }
  });

  it("keep superset groups to consecutive strength items", () => {
    for (const s of STARTER_TEMPLATES.flatMap((t) => t.sessions)) {
      const groups = s.items.map((i) => ("group" in i ? i.group : undefined));
      for (const g of new Set(groups.filter(Boolean))) {
        const idx = groups.flatMap((x, i) => (x === g ? [i] : []));
        expect(idx.length).toBeGreaterThan(1);
        expect(idx.at(-1)! - idx[0]).toBe(idx.length - 1);
      }
    }
  });
});
