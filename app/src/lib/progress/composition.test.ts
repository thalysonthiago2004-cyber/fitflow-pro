import { describe, expect, it } from "vitest";
import { bmi, estimateComposition, mifflinStJeor, navyBodyFat } from "./composition";

describe("bmi", () => {
  it("divides weight by height squared", () => {
    expect(bmi(70, 175)).toBe(22.9);
  });
});

describe("navyBodyFat", () => {
  // Reference values computed independently from the published metric equations.
  it("estimates men from neck and waist", () => {
    expect(navyBodyFat("male", 178, 38, 85, null)).toBe(16.4);
  });

  it("estimates women from neck, waist and hip", () => {
    expect(navyBodyFat("female", 165, 32, 72, 98)).toBe(27.4);
  });

  it("refuses impossible measurements", () => {
    expect(navyBodyFat("male", 178, 40, 38, null)).toBeNull();
    expect(navyBodyFat("female", 165, 32, 72, null)).toBeNull();
  });
});

describe("mifflinStJeor", () => {
  it("uses the sex-specific constant", () => {
    expect(mifflinStJeor("male", 80, 180, 30)).toBe(1780);
    expect(mifflinStJeor("female", 60, 165, 30)).toBe(1320);
  });
});

describe("estimateComposition", () => {
  it("derives fat and lean mass from the estimate", () => {
    const r = estimateComposition({ sex: "male", heightCm: 178, age: 30, weightKg: 80, neckCm: 38, waistCm: 85, hipCm: null });
    expect(r.bodyFatPct).toBe(16.4);
    expect(r.fatMassKg).toBe(13.1);
    expect(r.leanMassKg).toBe(66.9);
    expect(r.missing).toEqual([]);
  });

  it("reports what is missing instead of guessing", () => {
    const r = estimateComposition({ sex: null, heightCm: 165, age: null, weightKg: 60, neckCm: null, waistCm: 72, hipCm: null });
    expect(r.bmi).toBe(22);
    expect(r.bodyFatPct).toBeNull();
    expect(r.bmrKcal).toBeNull();
    expect(r.missing.sort()).toEqual(["age", "hipCm", "neckCm", "sex"]);
  });
});
