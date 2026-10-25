import { describe, expect, it } from "vitest";
import { formString, validationError } from "./form-state";
import { loginSchema } from "./schemas";

describe("validationError", () => {
  it("maps Zod issues to field errors", () => {
    const parsed = loginSchema.safeParse({ email: "x", password: "" });
    if (parsed.success) throw new Error("expected failure");
    const state = validationError(parsed.error, { email: "x" });
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toEqual(["Informe um e-mail válido."]);
    expect(state.fieldErrors?.password).toEqual(["Informe sua senha."]);
    expect(state.values).toEqual({ email: "x" });
  });
});

describe("formString", () => {
  it("returns strings and ignores files or missing keys", () => {
    const data = new FormData();
    data.set("name", "Ana");
    data.set("file", new Blob(["x"]));
    expect(formString(data, "name")).toBe("Ana");
    expect(formString(data, "file")).toBe("");
    expect(formString(data, "missing")).toBe("");
  });
});
