import type { Equipment, MuscleGroup, PlanStatus } from "@/lib/supabase/database.types";

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

export const muscleGroupOptions = Object.entries(MUSCLE_GROUP_LABELS).map(([value, label]) => ({ value, label }));
export const equipmentOptions = Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value, label }));
