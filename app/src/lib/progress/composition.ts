// Quick body composition from tape measurements. Every value here is an
// estimate and must be labeled as such; a bioimpedance scale or a lab method
// measures what these formulas only approximate.

import type { Sex } from "@/lib/supabase/database.types";

export type CompositionInput = {
  sex: Sex | null;
  heightCm: number | null;
  age: number | null;
  weightKg: number | null;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
};

export type MissingInput = "sex" | "heightCm" | "age" | "weightKg" | "neckCm" | "waistCm" | "hipCm";

export type CompositionEstimate = {
  bmi: number | null;
  bodyFatPct: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  bmrKcal: number | null;
  /** Inputs still needed for the values that came back null. */
  missing: MissingInput[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Body mass index: kg / m². */
export function bmi(weightKg: number, heightCm: number): number {
  return round1(weightKg / (heightCm / 100) ** 2);
}

/**
 * U.S. Navy circumference method (Hodgdon & Beckett, 1984), metric form.
 * Null when the measurements cannot produce a plausible result.
 */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm: number | null): number | null {
  let pct: number;
  if (sex === "male") {
    if (waistCm - neckCm <= 0) return null;
    pct = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (hipCm === null || waistCm + hipCm - neckCm <= 0) return null;
    pct = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return pct >= 2 && pct <= 70 ? round1(pct) : null;
}

/** Basal metabolic rate, Mifflin–St Jeor (1990). */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161));
}

export function estimateComposition(input: CompositionInput): CompositionEstimate {
  const { sex, heightCm, age, weightKg, neckCm, waistCm, hipCm } = input;
  const missing = new Set<MissingInput>();
  const need = (values: [MissingInput, unknown][]) => {
    for (const [key, value] of values) if (value === null) missing.add(key);
    return values.every(([, value]) => value !== null);
  };

  const result: CompositionEstimate = { bmi: null, bodyFatPct: null, fatMassKg: null, leanMassKg: null, bmrKcal: null, missing: [] };

  if (need([["weightKg", weightKg], ["heightCm", heightCm]])) result.bmi = bmi(weightKg!, heightCm!);

  const fatInputs: [MissingInput, unknown][] = [["sex", sex], ["heightCm", heightCm], ["neckCm", neckCm], ["waistCm", waistCm]];
  if (sex !== "male") fatInputs.push(["hipCm", hipCm]);
  if (need(fatInputs)) result.bodyFatPct = navyBodyFat(sex!, heightCm!, neckCm!, waistCm!, hipCm);

  if (result.bodyFatPct !== null && need([["weightKg", weightKg]])) {
    result.fatMassKg = round1((weightKg! * result.bodyFatPct) / 100);
    result.leanMassKg = round1(weightKg! - result.fatMassKg);
  }

  if (need([["sex", sex], ["weightKg", weightKg], ["heightCm", heightCm], ["age", age]])) {
    result.bmrKcal = mifflinStJeor(sex!, weightKg!, heightCm!, age!);
  }

  result.missing = [...missing];
  return result;
}
