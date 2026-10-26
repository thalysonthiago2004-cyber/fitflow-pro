"use client";

import { useState } from "react";
import { SelectField } from "@/components/forms/select-field";
import type { LoadSeries } from "@/lib/progress/queries";
import { WeightChart } from "./weight-chart";

// Best completed load per workout day for the chosen exercise.
export function LoadChart({ series }: { series: LoadSeries[] }) {
  const [exerciseId, setExerciseId] = useState(series[0]?.exerciseId ?? "");
  const current = series.find((s) => s.exerciseId === exerciseId);
  if (series.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">A evolução de carga aparece quando houver séries concluídas com carga.</p>;
  }
  return (
    <div className="grid gap-4">
      <SelectField
        name="loadExercise"
        id="load-exercise"
        label="Exercício"
        options={series.map((s) => ({ value: s.exerciseId, label: s.exerciseName }))}
        value={exerciseId}
        onChange={(e) => setExerciseId(e.target.value)}
        className="sm:max-w-80"
      />
      {current && (
        <WeightChart
          key={current.exerciseId}
          points={current.points}
          title={`Carga — ${current.exerciseName}`}
          emptyText="Com dois treinos registrados deste exercício, a evolução aparece aqui."
        />
      )}
    </div>
  );
}
