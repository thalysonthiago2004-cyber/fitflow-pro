import { describe, expect, it } from "vitest";
import { PARQ_QUESTIONS, parqSchema } from "./parq";

const allNo = Object.fromEntries(PARQ_QUESTIONS.map((q) => [q.key, "no"]));
const blankDetails = { medications: "", conditions: "", injuries: "", notes: "" };

describe("parqSchema", () => {
  it("clears the student when every answer is no", () => {
    expect(parqSchema.parse({ ...allNo, ...blankDetails })).toMatchObject({ needsClearance: false, answers: { medications: null } });
  });

  it("recommends medical clearance on any yes", () => {
    expect(parqSchema.parse({ ...allNo, q5: "yes", ...blankDetails, injuries: "Joelho" }).needsClearance).toBe(true);
  });

  it("requires every screening question", () => {
    const partial = Object.fromEntries(Object.entries(allNo).filter(([key]) => key !== "q3"));
    expect(parqSchema.safeParse({ ...partial, ...blankDetails }).error?.issues[0]).toMatchObject({ path: ["q3"], message: "Responda sim ou não." });
  });
});
