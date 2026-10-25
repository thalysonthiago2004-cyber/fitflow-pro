import { describe, expect, it } from "vitest";
import { foodSchema, mealItemSchema, mealSchema } from "./schemas";

const base = { name: "Ovo cozido", basis: "g", kcal: "146", protein: "13,3", carbs: "0,6", fat: "9,5", fiber: "", unitLabel: "", unitAmount: "", source: "Rótulo" };

describe("foodSchema", () => {
  it("parses decimal commas and optional fields", () => {
    expect(foodSchema.parse(base)).toMatchObject({ protein: 13.3, fiber: null, unitLabel: null, unitAmount: null });
  });
  it("requires a source", () => {
    expect(foodSchema.safeParse({ ...base, source: "" }).error?.issues[0].path).toEqual(["source"]);
  });
  it("requires both parts of a household measure", () => {
    const r = foodSchema.safeParse({ ...base, unitLabel: "unidade", unitAmount: "" });
    expect(r.error?.issues[0].path).toEqual(["unitAmount"]);
    expect(foodSchema.parse({ ...base, unitLabel: "unidade", unitAmount: "50" }).unitAmount).toBe(50);
  });
  it("rejects impossible macro totals", () => {
    expect(foodSchema.safeParse({ ...base, protein: "60", carbs: "50" }).success).toBe(false);
  });
});

describe("meal schemas", () => {
  it("validates times and quantities", () => {
    expect(mealSchema.parse({ name: "Almoço", timeOfDay: "12:30", notes: "" }).timeOfDay).toBe("12:30");
    expect(mealSchema.safeParse({ name: "Almoço", timeOfDay: "25:00", notes: "" }).success).toBe(false);
    expect(mealItemSchema.parse({ quantity: "1,5", unit: "unit", notes: "" }).quantity).toBe(1.5);
    expect(mealItemSchema.safeParse({ quantity: "0", unit: "g", notes: "" }).success).toBe(false);
  });
});
