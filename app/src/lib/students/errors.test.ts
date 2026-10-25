import { describe, expect, it } from "vitest";
import { GENERIC_DB_ERROR, dbErrorMessage } from "./errors";

describe("dbErrorMessage", () => {
  it("maps known codes and hides unknown errors", () => {
    expect(dbErrorMessage({ message: "already_student" })).toMatch(/já pertence/);
    expect(dbErrorMessage({ message: "duplicate key value violates unique constraint" })).toBe(GENERIC_DB_ERROR);
    expect(dbErrorMessage(null)).toBe(GENERIC_DB_ERROR);
  });
});
