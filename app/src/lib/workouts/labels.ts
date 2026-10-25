import { formatNumber } from "@/lib/format";
import type { CardioIntensity, CardioMode, Equipment, MuscleGroup, PlanStatus } from "@/lib/supabase/database.types";
import type { CardioTarget, Prescription } from "./queries";

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Peito",
  back: "Costas",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebraços",
  core: "Abdômen e core",
  quadriceps: "Quadríceps",
  hamstrings: "Posteriores de coxa",
  glutes: "Glúteos",
  calves: "Panturrilhas",
  full_body: "Corpo inteiro",
  cardio: "Cardio",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barra",
  dumbbell: "Halteres",
  machine: "Máquina",
  cable: "Polia",
  bodyweight: "Peso corporal",
  kettlebell: "Kettlebell",
  band: "Elástico",
  other: "Outro",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};

export const PLAN_STATUS_TONES = { draft: "warning", active: "success", archived: "neutral" } as const;

// Index matches JavaScript's Date#getDay (0 = Sunday).
export const WEEKDAYS = [
  { short: "Dom", long: "Domingo" },
  { short: "Seg", long: "Segunda-feira" },
  { short: "Ter", long: "Terça-feira" },
  { short: "Qua", long: "Quarta-feira" },
  { short: "Qui", long: "Quinta-feira" },
  { short: "Sex", long: "Sexta-feira" },
  { short: "Sáb", long: "Sábado" },
] as const;

export function formatWeekdays(days: number[]): string {
  if (days.length === 0) return "Sem dia fixo";
  return [...days].sort((a, b) => a - b).map((d) => WEEKDAYS[d]?.short ?? "").join(", ");
}

export function formatReps(min: number, max: number | null): string {
  return max && max !== min ? `${min}–${max}` : `${min}`;
}

export function formatRest(seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export const CARDIO_MODE_LABELS: Record<CardioMode, string> = {
  continuous: "Contínuo",
  intervals: "Intervalado",
};

export const INTENSITY_LABELS: Record<CardioIntensity, string> = {
  light: "Leve",
  moderate: "Moderada",
  vigorous: "Intensa",
};

/** "30 min · 5 km · moderada · FC 130–150 bpm" or "8 × 1 min, descanso 1 min 30 s · intensa". */
export function formatCardio(c: CardioTarget): string {
  const parts: string[] = [];
  if (c.mode === "intervals" && c.rounds && c.workSeconds) {
    const rest = formatRest(c.restSeconds);
    parts.push(`${c.rounds} × ${formatRest(c.workSeconds)}${rest ? `, descanso ${rest}` : ""}`);
  } else {
    if (c.durationMinutes) parts.push(`${c.durationMinutes} min`);
    if (c.distanceKm) parts.push(`${formatNumber(c.distanceKm, 2)} km`);
  }
  if (c.intensity) parts.push(INTENSITY_LABELS[c.intensity].toLowerCase());
  if (c.hrMin || c.hrMax) parts.push(`FC ${c.hrMin && c.hrMax ? `${c.hrMin}–${c.hrMax}` : (c.hrMin ?? c.hrMax)} bpm`);
  if (c.speedKmh) parts.push(`${formatNumber(c.speedKmh, 1)} km/h`);
  if (c.inclinePct) parts.push(`inclinação ${formatNumber(c.inclinePct, 1)}%`);
  return parts.join(" · ");
}

/** One-line target for any prescribed item. */
export function formatPrescription(item: Prescription): string {
  if (item.kind === "cardio") return formatCardio(item.cardio);
  const rest = formatRest(item.restSeconds);
  return [
    `${item.sets} × ${formatReps(item.repsMin, item.repsMax)}`,
    item.loadKg !== null ? `${formatNumber(item.loadKg, 2)} kg` : null,
    rest ? `descanso ${rest}` : null,
  ].filter(Boolean).join(" · ");
}

/** Units counted toward progress: each strength set, and each cardio block as one. */
export function plannedUnits(items: Prescription[]): number {
  return items.reduce((sum, item) => sum + (item.kind === "cardio" ? 1 : item.sets), 0);
}

export const muscleGroupOptions = Object.entries(MUSCLE_GROUP_LABELS).map(([value, label]) => ({ value, label }));
export const equipmentOptions = Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value, label }));
