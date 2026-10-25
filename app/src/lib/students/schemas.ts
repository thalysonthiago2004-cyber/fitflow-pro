import { z } from "zod";
import { parseDecimal, todayISO } from "@/lib/format";
import type { ExperienceLevel, Sex, StudentStatus } from "@/lib/supabase/database.types";

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export const SEX_LABELS: Record<Sex, string> = {
  female: "Feminino",
  male: "Masculino",
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Ativo",
  archived: "Arquivado",
};

export const inviteStudentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Informe o nome do aluno.")
    .max(120, "Nome muito longo."),
  email: z
    .string()
    .trim()
    .min(1, "Informe o e-mail do aluno.")
    .max(254, "E-mail muito longo.")
    .pipe(z.email("Informe um e-mail válido."))
    .transform((value) => value.toLowerCase()),
});

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

export const studentProfileSchema = z.object({
  goal: optionalText(500, "O objetivo pode ter no máximo 500 caracteres."),
  experienceLevel: z
    .enum(["", "beginner", "intermediate", "advanced"], { error: "Selecione um nível válido." })
    .transform((value) => (value === "" ? null : value)),
  sex: z
    .enum(["", "female", "male"], { error: "Selecione uma opção válida." })
    .transform((value) => (value === "" ? null : value)),
  birthDate: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Data inválida.")
    .refine((value) => value === "" || (value >= "1900-01-01" && value <= todayISO()), {
      message: "Informe uma data de nascimento válida.",
    })
    .transform((value) => value || null),
  heightCm: z
    .preprocess(
      parseDecimal,
      z
        .number({ error: "Informe a altura em centímetros, ex.: 172,5." })
        .min(50, "A altura deve estar entre 50 e 260 cm.")
        .max(260, "A altura deve estar entre 50 e 260 cm.")
        .optional(),
    )
    .transform((value) => (value === undefined ? null : Math.round(value * 10) / 10)),
  limitations: optionalText(1000, "As limitações podem ter no máximo 1000 caracteres."),
});

export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
