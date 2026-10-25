import { z } from "zod";
import { formatNumber, parseDecimal, todayISO } from "@/lib/format";
import type { MeasurementSource, PhotoPose } from "@/lib/supabase/database.types";

const measure = (label: string, min: number, max: number, int = false) =>
  z.preprocess(
    parseDecimal,
    z
      .number({ error: `${label}: use um número, ex.: ${int ? "6" : "72,5"}.` })
      .min(min, `${label}: use entre ${min} e ${max}.`)
      .max(max, `${label}: use entre ${min} e ${max}.`)
      .refine((n) => !int || Number.isInteger(n), `${label}: use um número inteiro.`)
      .optional(),
  );

// `forms` says where each value is entered: the tape-measure form, the
// bioimpedance-scale form, or both.
export const MEASUREMENT_FIELDS = [
  { key: "weightKg", label: "Peso (kg)", short: "Peso", unit: "kg", column: "weight_kg", min: 20, max: 400, forms: ["manual", "bioimpedance"] },
  { key: "bodyFatPct", label: "Gordura corporal (%)", short: "Gordura", unit: "%", column: "body_fat_pct", min: 2, max: 70, forms: ["manual", "bioimpedance"] },
  { key: "neckCm", label: "Pescoço (cm)", short: "Pescoço", unit: "cm", column: "neck_cm", min: 20, max: 80, forms: ["manual"] },
  { key: "waistCm", label: "Cintura (cm)", short: "Cintura", unit: "cm", column: "waist_cm", min: 30, max: 250, forms: ["manual"] },
  { key: "hipCm", label: "Quadril (cm)", short: "Quadril", unit: "cm", column: "hip_cm", min: 30, max: 250, forms: ["manual"] },
  { key: "chestCm", label: "Peito (cm)", short: "Peito", unit: "cm", column: "chest_cm", min: 30, max: 250, forms: ["manual"] },
  { key: "armCm", label: "Braço (cm)", short: "Braço", unit: "cm", column: "arm_cm", min: 10, max: 100, forms: ["manual"] },
  { key: "thighCm", label: "Coxa (cm)", short: "Coxa", unit: "cm", column: "thigh_cm", min: 20, max: 150, forms: ["manual"] },
  { key: "muscleMassKg", label: "Massa muscular (kg)", short: "Massa muscular", unit: "kg", column: "muscle_mass_kg", min: 5, max: 200, forms: ["bioimpedance"] },
  { key: "bodyWaterPct", label: "Água corporal (%)", short: "Água", unit: "%", column: "body_water_pct", min: 20, max: 80, forms: ["bioimpedance"] },
  { key: "visceralFat", label: "Gordura visceral (nível)", short: "Visceral", unit: "nível", column: "visceral_fat", min: 1, max: 59, int: true, forms: ["bioimpedance"] },
  { key: "bmrKcal", label: "Taxa metabólica basal (kcal)", short: "TMB", unit: "kcal", column: "bmr_kcal", min: 500, max: 5000, int: true, forms: ["bioimpedance"] },
] as const satisfies readonly {
  key: string;
  label: string;
  short: string;
  unit: string;
  column: string;
  min: number;
  max: number;
  int?: boolean;
  forms: readonly MeasurementSource[];
}[];

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]["key"];

export const fieldsFor = (source: MeasurementSource) => MEASUREMENT_FIELDS.filter((f) => (f.forms as readonly string[]).includes(source));

/** "72,5 kg", "18%", "nível 6". */
export function formatMeasure(field: (typeof MEASUREMENT_FIELDS)[number], value: number): string {
  if (field.unit === "%") return `${formatNumber(value, 1)}%`;
  if (field.unit === "nível") return `nível ${value}`;
  return `${formatNumber(value, 1)} ${field.unit}`;
}

const values = Object.fromEntries(
  MEASUREMENT_FIELDS.map((f) => [f.key, measure(f.short, f.min, f.max, "int" in f && f.int)]),
) as Record<MeasurementKey, ReturnType<typeof measure>>;

export const measurementSchema = z
  .object({
    measuredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da medição.")
      .refine((v) => v >= "2000-01-01" && v <= todayISO(), "A data não pode ser no futuro."),
    source: z.enum(["manual", "bioimpedance"]).catch("manual"),
    ...values,
    notes: z.string().trim().max(500, "Use no máximo 500 caracteres.").transform((v) => v || null),
  })
  .refine((d) => MEASUREMENT_FIELDS.some((f) => d[f.key] !== undefined), {
    message: "Informe pelo menos uma medida.",
    path: ["weightKg"],
  });

export const POSE_LABELS: Record<PhotoPose, string> = { front: "Frente", side: "Lado", back: "Costas" };

export const progressPhotoSchema = z.object({
  takenOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da foto.")
    .refine((v) => v >= "2000-01-01" && v <= todayISO(), "A data não pode ser no futuro."),
  pose: z.enum(["front", "side", "back"], { error: "Escolha a posição da foto." }),
});
