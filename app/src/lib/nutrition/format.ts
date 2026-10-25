import { formatNumber } from "@/lib/format";
import type { MealItemUnit } from "@/lib/supabase/database.types";
import type { Food } from "./queries";
import type { Nutrients } from "./calc";

/** "150 g", "200 ml", "2 × unidade (100 g)". The "×" form avoids pluralizing
 * free-text household measures ("colher de sopa"), which is error-prone. */
export function formatQuantity(quantity: number, unit: MealItemUnit, food: Pick<Food, "basis" | "unitLabel" | "unitAmount">): string {
  if (unit !== "unit") return `${formatNumber(quantity, 1)} ${unit}`;
  const label = food.unitLabel ?? "unidade";
  const total = food.unitAmount !== null ? ` (${formatNumber(quantity * food.unitAmount, 1)} ${food.basis})` : "";
  return `${formatNumber(quantity, 1)} × ${label}${total}`;
}

export function formatKcal(kcal: number): string {
  return `${formatNumber(Math.round(kcal), 0)} kcal`;
}

export function formatGrams(g: number | null): string {
  return g === null ? "—" : `${formatNumber(g, 1)} g`;
}

export function macroLine(n: Nutrients): string {
  return `P ${formatGrams(n.protein)} · C ${formatGrams(n.carbs)} · G ${formatGrams(n.fat)}`;
}
