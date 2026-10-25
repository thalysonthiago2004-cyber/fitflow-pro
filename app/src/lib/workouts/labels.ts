import { formatNumber } from "@/lib/format";
import type { CardioIntensity, CardioMode, Equipment, MuscleGroup, PlanStatus } from "@/lib/supabase/database.types";
import type { CardioTarget, Prescription, StrengthPrescription } from "./queries";

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

/** "12/10/8" when each set has its own target, otherwise the shared range. */
export function formatSetReps(item: Pick<StrengthPrescription, "repsMin" | "repsMax" | "repsPerSet">): string {
  return item.repsPerSet ? item.repsPerSet.join("/") : formatReps(item.repsMin, item.repsMax);
}

/** Target repetitions for one set (1-based), used as the logger's placeholder. */
export function repsForSet(item: Pick<StrengthPrescription, "repsMin" | "repsMax" | "repsPerSet">, setNumber: number): string {
  const own = item.repsPerSet?.[setNumber - 1];
  return own !== undefined ? String(own) : formatReps(item.repsMin, item.repsMax);
}

/** "Bi-set", "Tri-set" or "Circuito" for a group of this size. */
export function supersetLabel(size: number): string {
  return size === 2 ? "Bi-set" : size === 3 ? "Tri-set" : "Circuito";
}

/**
 * Splits a session's items into display blocks: consecutive strength items
 * sharing a superset group become one block, everything else stands alone.
 */
export function groupSupersets<T extends Prescription>(items: T[]): T[][] {
  const blocks: T[][] = [];
  for (const item of items) {
    const group = item.kind === "strength" ? item.supersetGroup : null;
    const last = blocks.at(-1);
    const lastItem = last?.at(-1);
    if (group && last && lastItem?.kind === "strength" && lastItem.supersetGroup === group) last.push(item);
    else blocks.push([item]);
  }
  return blocks;
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

/** One-line target for any prescribed item. Inside a superset, only the group's rest is shown, once. */
export function formatPrescription(item: Prescription, { withRest = true }: { withRest?: boolean } = {}): string {
  if (item.kind === "cardio") return formatCardio(item.cardio);
  const rest = withRest ? formatRest(item.restSeconds) : null;
  return [
    `${item.sets} × ${formatSetReps(item)}`,
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
