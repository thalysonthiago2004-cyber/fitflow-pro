import { CircleCheck, CircleDashed } from "lucide-react";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { RESISTANCE_TRAINING_MET, estimateWorkoutKcal } from "@/lib/progress/calc";
import { formatPrescription } from "@/lib/workouts/labels";
import type { LogDetail } from "@/lib/workouts/queries";

// Read-only summary of a recorded workout: prescribed vs. performed.
export function LogView({ log, weightKg = null }: { log: LogDetail; weightKg?: number | null }) {
  const kcal = estimateWorkoutKcal(weightKg, log.startedAt, log.completedAt);
  const hasCardio = log.exercises.some((e) => e.kind === "cardio");
  const done = log.sets.filter((s) => s.completed).length + log.cardio.filter((c) => c.completed).length;
  const planned = log.exercises.reduce((sum, e) => sum + (e.kind === "cardio" ? 1 : e.sets), 0);

  return (
    <div className="grid gap-6">
      <dl className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-4">
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Início</dt>
          <dd className="text-sm font-medium">{formatDateTime(log.startedAt)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Duração</dt>
          <dd className="text-sm font-medium">{log.completedAt ? formatDuration(log.startedAt, log.completedAt) : "Em andamento"}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">{hasCardio ? "Etapas concluídas" : "Séries concluídas"}</dt>
          <dd className="text-sm font-medium tabular-nums">{done} de {planned}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Plano</dt>
          <dd className="truncate text-sm font-medium">{log.planName}</dd>
        </div>
      </dl>

      {log.completedAt && (
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          {kcal !== null ? (
            <>
              <strong className="text-sm text-foreground">Gasto estimado ≈ {formatNumber(kcal, 0)} kcal.</strong> Cálculo: MET{" "}
              {formatNumber(RESISTANCE_TRAINING_MET, 1)} (treino resistido moderado, Compêndio de Atividades Físicas) × {formatNumber(weightKg!, 1)} kg × duração.
              É uma aproximação: varia com intensidade, pausas e características individuais.
            </>
          ) : (
            "Gasto calórico estimado indisponível: é preciso ter o peso registrado na evolução até a data do treino e uma duração entre 5 min e 4 h."
          )}
        </p>
      )}

      {log.notes && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Observações do aluno</p>
          <p className="mt-1 text-sm whitespace-pre-line">{log.notes}</p>
        </div>
      )}

      <ol className="grid gap-3">
        {log.exercises.map((item) => {
          const sets = log.sets.filter((s) => s.sessionExerciseId === item.id);
          if (item.kind === "cardio") {
            const c = log.cardio.find((entry) => entry.sessionExerciseId === item.id);
            const performed = c
              ? [
                  c.roundsDone != null && `${c.roundsDone} séries`,
                  c.durationMinutes != null && `${formatNumber(c.durationMinutes, 1)} min`,
                  c.distanceKm != null && `${formatNumber(c.distanceKm, 2)} km`,
                  c.avgHr != null && `FC média ${c.avgHr} bpm`,
                  c.rpe != null && `esforço ${c.rpe}/10`,
                ].filter(Boolean).join(" · ")
              : "";
            return (
              <li key={item.id} className="rounded-xl border bg-card p-4">
                <p className="font-medium">{item.exercise.name} <span className="text-sm font-normal text-muted-foreground">· cardio</span></p>
                <p className="text-sm text-muted-foreground">Prescrito: {formatPrescription(item)}</p>
                {c ? (
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    {c.completed ? <CircleCheck className="size-4 shrink-0 text-success" aria-hidden /> : <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                    <span className="tabular-nums">Realizado: {performed || "sem detalhes"}</span>
                    <span className="sr-only">{c.completed ? "concluído" : "não concluído"}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Cardio não registrado.</p>
                )}
              </li>
            );
          }
          return (
            <li key={item.id} className="rounded-xl border bg-card p-4">
              <p className="font-medium">{item.exercise.name}</p>
              <p className="text-sm text-muted-foreground">Prescrito: {formatPrescription(item)}</p>
              {sets.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma série registrada.</p>
              ) : (
                <ul className="mt-3 grid gap-1.5">
                  {sets.map((set) => (
                    <li key={set.id} className="flex items-center gap-2 text-sm">
                      {set.completed ? (
                        <CircleCheck className="size-4 text-success" aria-hidden />
                      ) : (
                        <CircleDashed className="size-4 text-muted-foreground" aria-hidden />
                      )}
                      <span className="w-16 text-muted-foreground">Série {set.setNumber}</span>
                      <span className="tabular-nums">
                        {set.reps ?? "–"} reps{set.loadKg !== null && ` · ${formatNumber(set.loadKg, 2)} kg`}
                      </span>
                      <span className="sr-only">{set.completed ? "concluída" : "não concluída"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
