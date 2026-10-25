import { describe, expect, it } from "vitest";
import { MEASUREMENT_FIELDS, measurementSchema } from "./schemas";

const blank = {
  measuredOn: "2026-10-01",
  source: "manual",
  ...Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, ""])),
  notes: "",
};

describe("measurementSchema", () => {
  it("parses decimal commas", () => {
    expect(measurementSchema.parse({ ...blank, weightKg: "72,4", waistCm: "80" })).toMatchObject({ weightKg: 72.4, waistCm: 80, bodyFatPct: undefined });
  });
  it("requires at least one value", () => {
    expect(measurementSchema.safeParse(blank).error?.issues[0].message).toBe("Informe pelo menos uma medida.");
  });
  it("rejects future dates and implausible values", () => {
    expect(measurementSchema.safeParse({ ...blank, weightKg: "70", measuredOn: "2999-01-01" }).success).toBe(false);
    expect(measurementSchema.safeParse({ ...blank, weightKg: "700" }).success).toBe(false);
  });
  it("keeps whole-number scale readings whole", () => {
    expect(measurementSchema.parse({ ...blank, source: "bioimpedance", visceralFat: "6", bmrKcal: "1650" })).toMatchObject({ source: "bioimpedance", visceralFat: 6, bmrKcal: 1650 });
    expect(measurementSchema.safeParse({ ...blank, visceralFat: "6,5" }).error?.issues[0].message).toBe("Visceral: use um número inteiro.");
  });
  it("falls back to a manual entry for an unknown source", () => {
    expect(measurementSchema.parse({ ...blank, source: "lab", weightKg: "70" }).source).toBe("manual");
  });
});
