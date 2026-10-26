import { describe, expect, it } from "vitest";
import { firebaseErrorMessage } from "./errors";

describe("firebaseErrorMessage", () => {
  it("reads the same for a wrong e-mail and a wrong password", () => {
    expect(firebaseErrorMessage({ code: "auth/user-not-found" })).toBe(firebaseErrorMessage({ code: "auth/wrong-password" }));
    expect(firebaseErrorMessage({ code: "auth/invalid-credential" })).toBe("E-mail ou senha incorretos.");
  });
  it("falls back to a generic message", () => {
    expect(firebaseErrorMessage(new Error("boom"))).toBe("Não foi possível concluir a ação. Tente novamente.");
  });
});
