import { describe, expect, it } from "vitest";
import { inviteStudentSchema, studentProfileSchema } from "./schemas";

const blank = { goal: "", experienceLevel: "", sex: "", birthDate: "", heightCm: "", limitations: "" };

describe("inviteStudentSchema", () => {
  it("normalizes e-mail and name", () => {
    expect(inviteStudentSchema.parse({ fullName: " Carla ", email: " Carla@X.com " })).toEqual({
      fullName: "Carla",
      email: "carla@x.com",
    });
  });
});

describe("studentProfileSchema", () => {
  it("turns blank fields into null", () => {
    expect(studentProfileSchema.parse(blank)).toEqual({
      goal: null,
      experienceLevel: null,
      sex: null,
      birthDate: null,
      heightCm: null,
      limitations: null,
    });
  });

  it("accepts Brazilian decimal input for height", () => {
    const parsed = studentProfileSchema.parse({ ...blank, heightCm: "172,5", experienceLevel: "beginner" });
    expect(parsed.heightCm).toBe(172.5);
    expect(parsed.experienceLevel).toBe("beginner");
  });

  it("rejects implausible values with pt-BR messages", () => {
    const result = studentProfileSchema.safeParse({ ...blank, heightCm: "17", birthDate: "2999-01-01" });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message);
    expect(messages).toContain("A altura deve estar entre 50 e 260 cm.");
    expect(messages).toContain("Informe uma data de nascimento válida.");
  });

  it("accepts only the listed sexes", () => {
    expect(studentProfileSchema.parse({ ...blank, sex: "female" }).sex).toBe("female");
    expect(studentProfileSchema.safeParse({ ...blank, sex: "other" }).error?.issues[0].message).toBe("Selecione uma opção válida.");
  });

  it("rejects non-numeric height", () => {
    const result = studentProfileSchema.safeParse({ ...blank, heightCm: "alto" });
    expect(result.error?.issues[0].message).toBe("Informe a altura em centímetros, ex.: 172,5.");
  });
});
