import { describe, expect, it } from "vitest";
import { TACO_FOODS, tacoSource } from "./taco";

describe("TACO dataset", () => {
  it("has the foods of the official table that are not under re-evaluation", () => {
    expect(TACO_FOODS).toHaveLength(592);
    expect(TACO_FOODS.find((f) => f.item === 1)).toEqual({
      item: 1, name: "Arroz, integral, cozido", category: "Cereais e derivados", kcal: 124, protein: 2.6, carbs: 25.8, fat: 1, fiber: 2.7,
    });
  });

  it("fits the foods table constraints", () => {
    for (const f of TACO_FOODS) {
      expect(f.name.length, f.name).toBeGreaterThanOrEqual(2);
      expect(f.name.length, f.name).toBeLessThanOrEqual(120);
      expect(f.kcal, f.name).toBeLessThanOrEqual(900);
      for (const v of [f.protein, f.carbs, f.fat, f.fiber ?? 0]) expect(v, f.name).toBeGreaterThanOrEqual(0);
      expect(f.protein + f.carbs + f.fat, f.name).toBeLessThanOrEqual(100);
    }
    expect(new Set(TACO_FOODS.map((f) => f.name.toLowerCase())).size).toBe(TACO_FOODS.length);
  });

  it("cites the table and item as the source", () => {
    expect(tacoSource(260)).toBe("TACO 4ª ed. (NEPA/UNICAMP, 2011), item 260");
  });
});
