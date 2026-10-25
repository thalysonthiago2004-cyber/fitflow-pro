import { describe, expect, it } from "vitest";
import { formatKcal, formatQuantity } from "./format";

describe("nutrition format", () => {
  it("formats quantities with household measures", () => {
    expect(formatQuantity(150, "g", { basis: "g", unitLabel: null, unitAmount: null })).toBe("150 g");
    expect(formatQuantity(2, "unit", { basis: "g", unitLabel: "unidade", unitAmount: 50 })).toBe("2 × unidade (100 g)");
    expect(formatQuantity(1.5, "unit", { basis: "ml", unitLabel: "copo", unitAmount: 200 })).toBe("1,5 × copo (300 ml)");
    expect(formatQuantity(2, "unit", { basis: "g", unitLabel: "colher de sopa", unitAmount: 15 })).toBe("2 × colher de sopa (30 g)");
  });

  it("rounds calories", () => {
    expect(formatKcal(1234.6)).toBe("1.235 kcal");
  });
});
