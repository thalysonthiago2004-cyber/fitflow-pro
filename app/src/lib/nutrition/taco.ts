import taco from "./taco.json";

// TACO, 4ª edição revisada e ampliada (NEPA/UNICAMP, 2011), per 100 g of
// edible portion. Built from the official spreadsheet by
// scripts/taco/build_taco.py; foods with values under re-evaluation are left out.

export type TacoFood = {
  item: number;
  name: string;
  category: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
};

export const TACO_FOODS = taco.foods as TacoFood[];

export const tacoSource = (item: number) => `TACO 4ª ed. (NEPA/UNICAMP, 2011), item ${item}`;
