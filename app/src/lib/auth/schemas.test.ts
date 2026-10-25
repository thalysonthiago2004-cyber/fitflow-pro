import { describe, expect, it } from "vitest";
import { loginSchema, resetPasswordSchema, signupSchema } from "./schemas";

describe("signupSchema", () => {
  it("normalizes valid input", () => {
    const result = signupSchema.parse({
      fullName: "  Ana Souza ",
      email: " Ana@Example.com ",
      password: "treino2026",
    });
    expect(result).toEqual({ fullName: "Ana Souza", email: "ana@example.com", password: "treino2026" });
  });

  it("rejects weak passwords with pt-BR messages", () => {
    const result = signupSchema.safeParse({ fullName: "Ana", email: "a@b.co", password: "curta" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "A senha precisa ter pelo menos 8 caracteres.",
    );
  });

  it("rejects invalid e-mails", () => {
    const result = signupSchema.safeParse({ fullName: "Ana", email: "ana", password: "treino2026" });
    expect(result.error?.issues[0].message).toBe("Informe um e-mail válido.");
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      "Informe seu e-mail.",
      "Informe sua senha.",
    ]);
  });
});

describe("resetPasswordSchema", () => {
  it("requires matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "treino2026",
      confirmPassword: "treino2027",
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["confirmPassword"],
      message: "As senhas não coincidem.",
    });
  });
});
