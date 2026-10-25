import { describe, expect, it } from "vitest";
import { baseAmount, itemNutrients, macroSplit, sumNutrients, type FoodValues } from "./calc";

const egg: FoodValues = { basis: "g", kcalPer100: 146, proteinPer100: 13.3, carbsPer100: 0.6, fatPer100: 9.5, fiberPer100: 0, unitAmount: 50 };
const milk: FoodValues = { basis: "ml", kcalPer100: 35, proteinPer100: 3.4, carbsPer100: 5, fatPer100: 0.1, fiberPer100: null, unitAmount: null };

describe("nutrition calc", () => {
  it("resolves household units and rejects mismatched ones", () => {
    expect(baseAmount(2, "unit", egg)).toBe(100);
    expect(baseAmount(150, "g", egg)).toBe(150);
    expect(baseAmount(150, "ml", egg)).toBeNull();
    expect(baseAmount(1, "unit", milk)).toBeNull();
  });

  it("scales per-100 values", () => {
    const n = itemNutrients(2, "unit", egg);
    expect(n.kcal).toBeCloseTo(146);
    expect(n.protein).toBeCloseTo(13.3);
    expect(itemNutrients(200, "ml", milk).kcal).toBeCloseTo(70);
  });

  it("marks fiber unknown when any item lacks it", () => {
    const total = sumNutrients([itemNutrients(2, "unit", egg), itemNutrients(200, "ml", milk)]);
    expect(total.kcal).toBeCloseTo(216);
    expect(total.fiber).toBeNull();
    expect(sumNutrients([itemNutrients(1, "unit", egg)]).fiber).toBe(0);
  });

  it("computes energy split from macros", () => {
    expect(macroSplit({ kcal: 0, protein: 25, carbs: 50, fat: 11.1, fiber: null })).toEqual({ protein: 25, carbs: 50, fat: 25 });
    expect(macroSplit({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })).toBeNull();
  });
});
