import { z } from "zod";
import { parseDecimal } from "@/lib/format";

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).transform((value) => value || null);

const decimal = (label: string, max: number) =>
  z.preprocess(
    parseDecimal,
    z.number({ error: `Informe ${label}.` }).min(0, "O valor não pode ser negativo.").max(max, `Use no máximo ${max}.`),
  );

const optionalDecimal = (max: number) =>
  z.preprocess(parseDecimal, z.number({ error: "Valor inválido." }).min(0, "O valor não pode ser negativo.").max(max, `Use no máximo ${max}.`).optional());

export const foodSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do alimento.").max(120, "Nome muito longo."),
    basis: z.enum(["g", "ml"], { error: "Selecione a base." }),
    kcal: decimal("as calorias", 900),
    protein: decimal("as proteínas", 100),
    carbs: decimal("os carboidratos", 100),
    fat: decimal("as gorduras", 100),
    fiber: optionalDecimal(100),
    unitLabel: optionalText(40, "Use no máximo 40 caracteres."),
    unitAmount: optionalDecimal(5000),
    source: z.string().trim().min(2, "Informe a fonte dos valores (ex.: rótulo do produto, Tabela TACO).").max(200, "Fonte muito longa."),
  })
  .refine((d) => d.protein + d.carbs + d.fat <= 100, {
    message: "Proteínas, carboidratos e gorduras somam mais de 100 g em 100 g.",
    path: ["fat"],
  })
  .refine((d) => (d.unitLabel === null) === (d.unitAmount === undefined), {
    message: "Para usar uma medida caseira, informe o nome e quanto ela pesa.",
    path: ["unitAmount"],
  })
  .refine((d) => d.unitAmount === undefined || d.unitAmount > 0, { message: "Use um valor maior que zero.", path: ["unitAmount"] })
  .transform((d) => ({
    ...d,
    fiber: d.fiber ?? null,
    unitAmount: d.unitAmount ?? null,
  }));

export const mealPlanSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do plano.").max(120, "Nome muito longo."),
  notes: optionalText(2000, "As orientações podem ter no máximo 2000 caracteres."),
});

export const newMealPlanSchema = mealPlanSchema.and(z.object({ studentId: z.uuid("Selecione um aluno.") }));

export const mealSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da refeição.").max(80, "Nome muito longo."),
  timeOfDay: z
    .string()
    .trim()
    .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), "Horário inválido.")
    .transform((v) => v || null),
  notes: optionalText(500, "As observações podem ter no máximo 500 caracteres."),
});

export const mealItemSchema = z.object({
  quantity: z.preprocess(
    parseDecimal,
    z.number({ error: "Informe a quantidade." }).gt(0, "Use uma quantidade maior que zero.").max(5000, "Quantidade acima do limite."),
  ),
  unit: z.enum(["g", "ml", "unit"], { error: "Selecione a unidade." }),
  notes: optionalText(200, "Use no máximo 200 caracteres."),
});
