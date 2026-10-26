// Starter workout templates a trainer can add to their library in one click.
// They are general starting points built from the global catalog, saved as
// editable templates (never assigned to anyone): the trainer adapts them to
// each student before creating a plan.

import type { CardioIntensity } from "@/lib/supabase/database.types";

type Strength = { exercise: string; sets: number; reps: [number, number | null]; rest: number; group?: string };
type Cardio =
  | { exercise: string; cardio: "continuous"; minutes: number; intensity: CardioIntensity }
  | { exercise: string; cardio: "intervals"; rounds: number; work: number; rest: number; intensity: CardioIntensity };
export type StarterItem = Strength | Cardio;
export type StarterSession = { name: string; weekdays: number[]; items: StarterItem[] };
export type StarterTemplate = { key: string; name: string; notes: string; sessions: StarterSession[] };

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "iniciante",
    name: "Modelo inicial — Iniciante full body 3x",
    notes: "Corpo inteiro em três dias alternados. Priorize a técnica nas primeiras semanas e ajuste cargas para terminar as séries com 2 a 3 repetições de reserva.",
    sessions: [
      {
        name: "Treino A",
        weekdays: [1, 3, 5],
        items: [
          { exercise: "Esteira", cardio: "continuous", minutes: 8, intensity: "light" },
          { exercise: "Leg press 45°", sets: 3, reps: [10, 12], rest: 90 },
          { exercise: "Supino reto com barra", sets: 3, reps: [10, 12], rest: 90 },
          { exercise: "Puxada frontal na polia", sets: 3, reps: [10, 12], rest: 90 },
          { exercise: "Desenvolvimento com halteres", sets: 3, reps: [10, 12], rest: 60 },
          { exercise: "Mesa flexora", sets: 3, reps: [10, 12], rest: 60 },
          { exercise: "Abdominal supra", sets: 3, reps: [15, 20], rest: 45 },
        ],
      },
    ],
  },
  {
    key: "abc",
    name: "Modelo inicial — Hipertrofia ABC",
    notes: "Divisão em três treinos para quem já treina com regularidade. Faça cada treino 1 a 2 vezes por semana conforme a recuperação.",
    sessions: [
      {
        name: "Treino A — Peito e tríceps",
        weekdays: [1, 4],
        items: [
          { exercise: "Supino reto com barra", sets: 4, reps: [8, 10], rest: 120 },
          { exercise: "Supino inclinado com halteres", sets: 3, reps: [10, 12], rest: 90 },
          { exercise: "Crossover na polia", sets: 3, reps: [12, 15], rest: 60 },
          { exercise: "Tríceps francês com halter", sets: 3, reps: [10, 12], rest: 60, group: "a1" },
          { exercise: "Tríceps na polia", sets: 3, reps: [12, 15], rest: 60, group: "a1" },
        ],
      },
      {
        name: "Treino B — Costas e bíceps",
        weekdays: [2, 5],
        items: [
          { exercise: "Puxada frontal na polia", sets: 4, reps: [8, 10], rest: 120 },
          { exercise: "Remada curvada com barra", sets: 3, reps: [8, 10], rest: 90 },
          { exercise: "Remada unilateral com halter", sets: 3, reps: [10, 12], rest: 60 },
          { exercise: "Rosca direta com barra", sets: 3, reps: [10, 12], rest: 60, group: "b1" },
          { exercise: "Rosca martelo", sets: 3, reps: [10, 12], rest: 60, group: "b1" },
        ],
      },
      {
        name: "Treino C — Pernas e ombros",
        weekdays: [3, 6],
        items: [
          { exercise: "Agachamento livre", sets: 4, reps: [8, 10], rest: 120 },
          { exercise: "Stiff com barra", sets: 3, reps: [10, 12], rest: 90 },
          { exercise: "Cadeira extensora", sets: 3, reps: [12, 15], rest: 60 },
          { exercise: "Panturrilha em pé", sets: 4, reps: [12, 15], rest: 45 },
          { exercise: "Desenvolvimento com halteres", sets: 3, reps: [8, 10], rest: 90 },
          { exercise: "Elevação lateral", sets: 3, reps: [12, 15], rest: 45 },
        ],
      },
    ],
  },
  {
    key: "condicionamento",
    name: "Modelo inicial — Condicionamento e cardio",
    notes: "Força em circuito e cardio intervalado para melhorar o condicionamento. Ajuste a intensidade dos estímulos ao nível do aluno.",
    sessions: [
      {
        name: "Treino A — Circuito",
        weekdays: [1, 3],
        items: [
          { exercise: "Kettlebell swing", sets: 3, reps: [15, 15], rest: 0, group: "c1" },
          { exercise: "Agachamento búlgaro", sets: 3, reps: [10, 12], rest: 0, group: "c1" },
          { exercise: "Flexão de braço", sets: 3, reps: [10, 15], rest: 90, group: "c1" },
          { exercise: "Air bike", cardio: "intervals", rounds: 8, work: 20, rest: 40, intensity: "vigorous" },
        ],
      },
      {
        name: "Treino B — Cardio",
        weekdays: [5],
        items: [
          { exercise: "Esteira", cardio: "continuous", minutes: 30, intensity: "moderate" },
          { exercise: "Prancha", sets: 3, reps: [30, 45], rest: 45 },
        ],
      },
    ],
  },
];

export function starterExerciseNames(): string[] {
  return [...new Set(STARTER_TEMPLATES.flatMap((t) => t.sessions.flatMap((s) => s.items.map((i) => i.exercise))))];
}
