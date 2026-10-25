import type { FoodBasis, MealItemUnit } from "@/lib/supabase/database.types";

export type FoodValues = {
  basis: FoodBasis;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100: number | null;
  unitAmount: number | null;
};

export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** null when at least one contributing food has no fiber value. */
  fiber: number | null;
};

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/** Grams (or ml) represented by a meal item, or null when the unit is not available for the food. */
export function baseAmount(quantity: number, unit: MealItemUnit, food: FoodValues): number | null {
  if (unit === "unit") return food.unitAmount === null ? null : quantity * food.unitAmount;
  return unit === food.basis ? quantity : null;
}

export function itemNutrients(quantity: number, unit: MealItemUnit, food: FoodValues): Nutrients {
  const amount = baseAmount(quantity, unit, food);
  if (amount === null) return ZERO;
  const factor = amount / 100;
  return {
    kcal: food.kcalPer100 * factor,
    protein: food.proteinPer100 * factor,
    carbs: food.carbsPer100 * factor,
    fat: food.fatPer100 * factor,
    fiber: food.fiberPer100 === null ? null : food.fiberPer100 * factor,
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (total, n) => ({
      kcal: total.kcal + n.kcal,
      protein: total.protein + n.protein,
      carbs: total.carbs + n.carbs,
      fat: total.fat + n.fat,
      fiber: total.fiber === null || n.fiber === null ? null : total.fiber + n.fiber,
    }),
    ZERO,
  );
}

/** Share of energy from each macronutrient (4/4/9 kcal per gram), in whole percent. */
export function macroSplit(n: Nutrients): { protein: number; carbs: number; fat: number } | null {
  const energy = n.protein * 4 + n.carbs * 4 + n.fat * 9;
  if (energy <= 0) return null;
  return {
    protein: Math.round(((n.protein * 4) / energy) * 100),
    carbs: Math.round(((n.carbs * 4) / energy) * 100),
    fat: Math.round(((n.fat * 9) / energy) * 100),
  };
}
