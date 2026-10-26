import { describe, expect, it } from "vitest";
import { cardioMet } from "./met";

describe("cardioMet", () => {
  it("picks the activity's value for the intensity, moderate by default", () => {
    expect(cardioMet("Esteira", "vigorous")).toBe(9.8);
    expect(cardioMet("Bicicleta ergométrica", null)).toBe(6.8);
  });
  it("falls back to a generic aerobic value for custom activities", () => {
    expect(cardioMet("Trilha", "light")).toBe(3.5);
  });
});
