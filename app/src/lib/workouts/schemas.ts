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

// repsPerSet arrives as "12,10,8" (one value per set) when repsMode is "perSet".
export const prescriptionSchema = z
  .object({
    sets: requiredInt("as séries", 1, 20),
    repsMode: z.enum(["same", "perSet"]).catch("same"),
    repsMin: z.string().optional(),
    repsMax: z.string().optional(),
    repsPerSet: z.string().optional(),
    loadKg: z.preprocess(
      parseDecimal,
      z.number({ error: "Informe a carga em kg, ex.: 22,5." }).min(0, "A carga não pode ser negativa.").max(1000, "Carga acima do limite.").optional(),
    ),
    restSeconds: optionalInt("o descanso", 0, 900),
    notes: optionalText(500, "As observações podem ter no máximo 500 caracteres."),
  })
  .transform((data, ctx) => {
    const fail = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", message, path: [path] });
      return z.NEVER;
    };
    let repsMin: number;
    let repsMax: number | null;
    let repsPerSet: number[] | null = null;
    if (data.repsMode === "perSet") {
      const values = (data.repsPerSet ?? "").split(",").map((v) => Number(v.trim()));
      if (values.length !== data.sets || values.some((v) => !Number.isInteger(v) || v < 1 || v > 100)) {
        return fail("repsPerSet", "Escolha as repetições de cada série (entre 1 e 100).");
      }
      repsPerSet = values;
      repsMin = Math.min(...values);
      repsMax = Math.max(...values);
    } else {
      const min = requiredInt("as repetições", 1, 100).safeParse(data.repsMin);
      if (!min.success) return fail("repsMin", min.error.issues[0].message);
      const max = optionalInt("o máximo de repetições", 1, 100).safeParse(data.repsMax);
      if (!max.success) return fail("repsMax", max.error.issues[0].message);
      if (max.data !== undefined && max.data < min.data) return fail("repsMax", "O máximo precisa ser maior ou igual ao mínimo.");
      repsMin = min.data;
      repsMax = max.data ?? null;
    }
    return { sets: data.sets, repsMin, repsMax, repsPerSet, loadKg: data.loadKg, restSeconds: data.restSeconds, notes: data.notes };
  })
  .transform((data) => ({
    sets: data.sets,
    repsMin: data.repsMin,
    repsMax: data.repsMax,
    repsPerSet: data.repsPerSet,
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

const optionalDecimal = (label: string, min: number, max: number, example: string) =>
  z.preprocess(
    parseDecimal,
    z
      .number({ error: `Informe ${label}, ex.: ${example}.` })
      .min(min, `Use um valor entre ${String(min).replace(".", ",")} e ${max}.`)
      .max(max, `Use um valor entre ${String(min).replace(".", ",")} e ${max}.`)
      .optional(),
  );

// Cardio targets. Fields that do not apply to the chosen mode are dropped, so
// switching modes never leaves stale values behind.
export const cardioSchema = z
  .object({
    cardioMode: z.enum(["continuous", "intervals"], { error: "Escolha contínuo ou intervalado." }),
    durationMinutes: optionalInt("a duração", 1, 300),
    distanceKm: optionalDecimal("a distância em km", 0.1, 200, "5 ou 2,5"),
    rounds: optionalInt("as séries", 1, 50),
    workSeconds: optionalInt("o tempo de estímulo", 5, 1800),
    restSeconds: optionalInt("o descanso", 0, 900),
    intensity: z.preprocess(blankToUndefined, z.enum(["light", "moderate", "vigorous"], { error: "Selecione a intensidade." }).optional()),
    hrMin: optionalInt("a frequência mínima", 40, 220),
    hrMax: optionalInt("a frequência máxima", 40, 220),
    speedKmh: optionalDecimal("a velocidade em km/h", 0.5, 40, "8,5"),
    inclinePct: optionalDecimal("a inclinação em %", 0, 40, "2"),
    notes: optionalText(500, "As observações podem ter no máximo 500 caracteres."),
  })
  .superRefine((data, ctx) => {
    if (data.cardioMode === "continuous" && data.durationMinutes === undefined && data.distanceKm === undefined) {
      ctx.addIssue({ code: "custom", message: "Informe a duração ou a distância.", path: ["durationMinutes"] });
    }
    if (data.cardioMode === "intervals") {
      if (data.rounds === undefined) ctx.addIssue({ code: "custom", message: "Informe quantas séries.", path: ["rounds"] });
      if (data.workSeconds === undefined) ctx.addIssue({ code: "custom", message: "Informe o tempo de estímulo.", path: ["workSeconds"] });
    }
    if (data.hrMin !== undefined && data.hrMax !== undefined && data.hrMax < data.hrMin) {
      ctx.addIssue({ code: "custom", message: "A máxima precisa ser maior ou igual à mínima.", path: ["hrMax"] });
    }
  })
  .transform((data) => {
    const continuous = data.cardioMode === "continuous";
    const round = (n: number | undefined, digits: number) => (n === undefined ? null : Math.round(n * 10 ** digits) / 10 ** digits);
    return {
      cardioMode: data.cardioMode,
      durationMinutes: continuous ? (data.durationMinutes ?? null) : null,
      distanceKm: continuous ? round(data.distanceKm, 2) : null,
      rounds: continuous ? null : data.rounds!,
      workSeconds: continuous ? null : data.workSeconds!,
      restSeconds: continuous ? null : (data.restSeconds ?? null),
      intensity: data.intensity ?? null,
      hrMin: data.hrMin ?? null,
      hrMax: data.hrMax ?? null,
      speedKmh: round(data.speedKmh, 1),
      inclinePct: round(data.inclinePct, 1),
      notes: data.notes,
    };
  });

export const cardioLogSchema = z.object({
  durationMinutes: optionalDecimal("a duração em minutos", 0, 600, "30"),
  distanceKm: optionalDecimal("a distância em km", 0, 200, "4,5"),
  avgHr: optionalInt("a frequência média", 30, 230),
  rpe: optionalInt("o esforço", 1, 10),
  roundsDone: optionalInt("as séries feitas", 0, 50),
});
