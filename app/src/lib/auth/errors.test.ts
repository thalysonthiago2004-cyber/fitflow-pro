import { describe, expect, it } from "vitest";
import { GENERIC_AUTH_ERROR, authErrorMessage } from "./errors";

describe("authErrorMessage", () => {
  it("maps known codes", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("E-mail ou senha incorretos.");
  });

  it("maps rate limiting by status", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Muitas tentativas/);
  });

  it("never leaks raw messages", () => {
    expect(authErrorMessage({ code: "unexpected", message: "db exploded" })).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
  });
});
