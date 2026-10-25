import { z } from "zod";
import { parseDecimal } from "@/lib/format";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Data inválida.")
  .transform((value) => value || null);

const MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms", "core",
  "quadriceps", "hamstrings", "glutes", "calves", "full_body", "cardio",
] as const;
const EQUIPMENT = ["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other"] as const;

export const exerciseSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do exercício.").max(120, "Nome muito longo."),
  muscleGroup: z.enum(MUSCLE_GROUPS, { error: "Selecione o grupo muscular." }),
  equipment: z.enum(EQUIPMENT, { error: "Selecione o equipamento." }),
  instructions: optionalText(2000, "As instruções podem ter no máximo 2000 caracteres."),
  videoUrl: z
    .string()
    .trim()
    .max(500, "Link muito longo.")
    .refine((value) => value === "" || /^https:\/\/\S+$/.test(value), "Use um link completo começando com https://.")
    .transform((value) => value || null),
});

export const planSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do plano.").max(120, "Nome muito longo."),
    notes: optionalText(2000, "As observações podem ter no máximo 2000 caracteres."),
    startsOn: optionalDate,
    endsOn: optionalDate,
  })
  .refine((data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn, {
    message: "A data de término precisa ser depois do início.",
    path: ["endsOn"],
  });

export const newPlanSchema = planSchema.and(z.object({ studentId: z.uuid("Selecione um aluno.") }));

export const sessionSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do treino.").max(80, "Nome muito longo."),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).max(7).transform((days) => [...new Set(days)].sort()),
});

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const boundedInt = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `Informe ${label}.` })
    .int(`Use um número inteiro para ${label}.`)
    .min(min, `Use um valor entre ${min} e ${max}.`)
    .max(max, `Use um valor entre ${min} e ${max}.`);

const requiredInt = (label: string, min: number, max: number) =>
  z.preprocess(blankToUndefined, boundedInt(label, min, max));

const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(blankToUndefined, boundedInt(label, min, max).optional());

export const prescriptionSchema = z
  .object({
    sets: requiredInt("as séries", 1, 20),
    repsMin: requiredInt("as repetições", 1, 100),
    repsMax: optionalInt("o máximo de repetições", 1, 100),
    loadKg: z.preprocess(
      parseDecimal,
      z.number({ error: "Informe a carga em kg, ex.: 22,5." }).min(0, "A carga não pode ser negativa.").max(1000, "Carga acima do limite.").optional(),
    ),
    restSeconds: optionalInt("o descanso", 0, 900),
    notes: optionalText(500, "As observações podem ter no máximo 500 caracteres."),
  })
  .refine((data) => data.repsMax === undefined || data.repsMax >= data.repsMin, {
    message: "O máximo precisa ser maior ou igual ao mínimo.",
    path: ["repsMax"],
  })
  .transform((data) => ({
    sets: data.sets,
    repsMin: data.repsMin,
    repsMax: data.repsMax ?? null,
    loadKg: data.loadKg === undefined ? null : Math.round(data.loadKg * 100) / 100,
    restSeconds: data.restSeconds ?? null,
    notes: data.notes,
  }));

export const setLogSchema = z.object({
  reps: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number({ error: "Repetições inválidas." }).int("Use um número inteiro.").min(0).max(200).optional(),
  ),
  loadKg: z.preprocess(parseDecimal, z.number({ error: "Carga inválida." }).min(0).max(1000).optional()),
});
