"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import type { CardioLog, CardioPrescription } from "@/lib/workouts/queries";
import { cn } from "@/lib/utils";
import { saveCardio } from "../../actions";

export type CardioStatus = { completed: boolean; saving: boolean };

const input =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 dark:bg-input/30";

const RPE_OPTIONS = [
  { value: "", label: "—" },
  ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}` })),
];

// What the student actually did in a cardio block. Values are saved when the
// block is marked done; until then they stay editable.
export function CardioBlock({
  logId,
  item,
  saved,
  onStatus,
}: {
  logId: string;
  item: CardioPrescription;
  saved: CardioLog | undefined;
  onStatus: (status: CardioStatus) => void;
}) {
  const target = item.cardio;
  const intervals = target.mode === "intervals";
  const [values, setValues] = useState({
    durationMinutes: saved?.durationMinutes != null ? formatNumber(saved.durationMinutes, 1) : target.durationMinutes != null ? String(target.durationMinutes) : "",
    distanceKm: saved?.distanceKm != null ? formatNumber(saved.distanceKm, 2) : "",
    avgHr: saved?.avgHr != null ? String(saved.avgHr) : "",
    rpe: saved?.rpe != null ? String(saved.rpe) : "",
    roundsDone: saved?.roundsDone != null ? String(saved.roundsDone) : target.rounds != null ? String(target.rounds) : "",
  });
  const [status, setStatus] = useState<CardioStatus>({ completed: saved?.completed ?? false, saving: false });
  const name = item.exercise.name;

  function report(next: CardioStatus) {
    setStatus(next);
    onStatus(next);
  }

  async function toggle() {
    const completed = !status.completed;
    report({ completed, saving: true });
    const result = await saveCardio({ logId, sessionExerciseId: item.id, ...values, completed });
    if (!result.ok) {
      report({ completed: status.completed, saving: false });
      toast.error(result.message);
      return;
    }
    report({ completed, saving: false });
  }

  const set = (key: keyof typeof values, pattern: RegExp, max: number) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value.replace(pattern, "").slice(0, max) }));

  return (
    <div className={cn("grid gap-3 rounded-lg p-1", status.completed && "bg-brand/15 dark:bg-brand/10")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {intervals ? (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Séries feitas
            <input aria-label={`Séries feitas — ${name}`} inputMode="numeric" value={values.roundsDone} disabled={status.completed} onChange={(e) => set("roundsDone", /[^\d]/g, 2)(e.target.value)} className={input} />
          </label>
        ) : (
          <label className="grid gap-1 text-xs text-muted-foreground">
            Duração (min)
            <input aria-label={`Duração em minutos — ${name}`} inputMode="decimal" value={values.durationMinutes} disabled={status.completed} onChange={(e) => set("durationMinutes", /[^\d.,]/g, 5)(e.target.value)} className={input} />
          </label>
        )}
        <label className="grid gap-1 text-xs text-muted-foreground">
          Distância (km)
          <input aria-label={`Distância em km — ${name}`} inputMode="decimal" placeholder="Opcional" value={values.distanceKm} disabled={status.completed} onChange={(e) => set("distanceKm", /[^\d.,]/g, 6)(e.target.value)} className={input} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          FC média (bpm)
          <input aria-label={`Frequência cardíaca média — ${name}`} inputMode="numeric" placeholder="Opcional" value={values.avgHr} disabled={status.completed} onChange={(e) => set("avgHr", /[^\d]/g, 3)(e.target.value)} className={input} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Esforço (1–10)
          <select aria-label={`Esforço percebido de 1 a 10 — ${name}`} value={values.rpe} disabled={status.completed} onChange={(e) => setValues((c) => ({ ...c, rpe: e.target.value }))} className={cn(input, "[&>option]:bg-popover")}>
            {RPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <Button
        type="button"
        variant={status.completed ? "default" : "outline"}
        aria-pressed={status.completed}
        disabled={status.saving}
        onClick={toggle}
        className={cn("sm:justify-self-start", status.completed && "bg-brand text-brand-foreground hover:bg-brand/90 dark:glow-brand")}
      >
        {status.saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
        {status.completed ? `Cardio concluído — ${name}` : `Concluir cardio — ${name}`}
      </Button>
      <p className="text-xs text-muted-foreground">Esforço percebido: 1 = muito leve, 10 = máximo.</p>
    </div>
  );
}
