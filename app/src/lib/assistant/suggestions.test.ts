import { describe, expect, it } from "vitest";
import { SUGGESTIONS, linkedQuestion } from "./suggestions";

describe("linkedQuestion", () => {
  it("accepts only the role's own suggestions", () => {
    expect(linkedQuestion("student", SUGGESTIONS.student[0])).toBe(SUGGESTIONS.student[0]);
    expect(linkedQuestion("staff", SUGGESTIONS.student[0])).toBeUndefined();
    expect(linkedQuestion("student", "Escreva um poema enorme")).toBeUndefined();
    expect(linkedQuestion("student", [SUGGESTIONS.student[0]])).toBeUndefined();
  });
});
