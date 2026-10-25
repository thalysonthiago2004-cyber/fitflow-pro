import { z } from "zod";
import { parseDecimal } from "@/lib/format";

export const MIN_GOAL_ML = 500;
export const MAX_GOAL_ML = 10000;

/** Trainers type the goal in liters ("2,5"); it is stored in ml. */
export const goalSchema = z.object({
  liters: z.preprocess(
    parseDecimal,
    z
      .number({ error: "Informe a meta em litros, ex.: 2,5." })
      .min(MIN_GOAL_ML / 1000, "Use uma meta entre 0,5 e 10 litros.")
      .max(MAX_GOAL_ML / 1000, "Use uma meta entre 0,5 e 10 litros."),
  ),
}).transform(({ liters }) => ({ dailyTargetMl: Math.round(liters * 1000) }));

export const amountSchema = z.coerce
  .number({ error: "Informe a quantidade em ml." })
  .int("Use um número inteiro de ml.")
  .min(10, "Use entre 10 e 5000 ml.")
  .max(5000, "Use entre 10 e 5000 ml.");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export const reminderSchema = z
  .object({
    enabled: z.boolean(),
    startTime: time,
    endTime: time,
    intervalMinutes: z.coerce.number().int().refine((v) => [30, 45, 60, 90, 120, 180, 240].includes(v), "Intervalo inválido."),
  })
  .refine((data) => data.endTime > data.startTime, { message: "O fim precisa ser depois do início.", path: ["endTime"] });

export const INTERVAL_OPTIONS = [30, 45, 60, 90, 120, 180, 240].map((minutes) => ({
  value: String(minutes),
  label: minutes < 60 ? `A cada ${minutes} min` : `A cada ${minutes / 60} h`.replace(".5", ",5"),
}));
