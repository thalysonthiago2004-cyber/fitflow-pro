"use client";

import { Check, ChevronDown, LoaderCircle, Timer, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { ExerciseDemo } from "@/components/workouts/exercise-demo";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";
import { formatNumber } from "@/lib/format";
import { formatReps, formatRest } from "@/lib/workouts/labels";
import type { LogDetail, Prescription } from "@/lib/workouts/queries";
import { cn } from "@/lib/utils";
import { discardWorkout, finishWorkout, saveSet } from "../../actions";

type SetState = { reps: string; loadKg: string; completed: boolean; saving: boolean };

function initialSets(log: LogDetail): Record<string, SetState[]> {
  return Object.fromEntries(
    log.exercises.map((item) => [
      item.id,
      Array.from({ length: item.sets }, (_, i) => {
        const saved = log.sets.find((s) => s.sessionExerciseId === item.id && s.setNumber === i + 1);
        return {
          reps: saved?.reps != null ? String(saved.reps) : "",
          loadKg: saved?.loadKg != null ? formatNumber(saved.loadKg, 2) : item.loadKg != null ? formatNumber(item.loadKg, 2) : "",
          completed: saved?.completed ?? false,
          saving: false,
        };
      }),
    ]),
  );
}

export function WorkoutLogger({ log }: { log: LogDetail }) {
  const [sets, setSets] = useState(() => initialSets(log));
  const [rest, setRest] = useState<{ total: number; endsAt: number } | null>(null);

  const done = Object.values(sets).flat().filter((s) => s.completed).length;
  const planned = Object.values(sets).flat().length;
  const saving = Object.values(sets).flat().some((s) => s.saving);

  // Leaving mid-save would drop the set; ask the browser to confirm first.
  useEffect(() => {
    if (!saving) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saving]);

  function update(itemId: string, index: number, patch: Partial<SetState>) {
    setSets((current) => ({
      ...current,
      [itemId]: current[itemId].map((set, i) => (i === index ? { ...set, ...patch } : set)),
    }));
  }

  async function toggle(item: Prescription, index: number) {
    const set = sets[item.id][index];
    const completed = !set.completed;
    update(item.id, index, { completed, saving: true });
    const result = await saveSet({
      logId: log.id,
      sessionExerciseId: item.id,
      setNumber: index + 1,
      reps: set.reps,
      loadKg: set.loadKg,
      completed,
    });
    update(item.id, index, { saving: false, ...(result.ok ? {} : { completed: set.completed }) });
    if (!result.ok) return void toast.error(result.message);
    if (completed && item.restSeconds) setRest({ total: item.restSeconds, endsAt: Date.now() + item.restSeconds * 1000 });
  }

  return (
    <div className="grid gap-6 pb-24">
      <div className="sticky top-16 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border lg:top-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Progresso</span>
          <span className="tabular-nums text-muted-foreground" aria-live="polite">{done} de {planned} séries</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--meter-track)]"
          role="progressbar"
          aria-label="Séries concluídas"
          aria-valuemin={0}
          aria-valuemax={planned}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-[var(--meter-fill)] transition-[width] motion-reduce:transition-none dark:shadow-[0_0_10px_rgb(183_243_74/0.6)]" style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
        </div>
      </div>

      <ol className="grid gap-4">
        {log.exercises.map((item, exerciseIndex) => (
          <li key={item.id} className="grid gap-4 rounded-3xl border bg-card p-4 sm:p-5">
            <div className="grid gap-1">
              <p className="text-xs font-medium text-muted-foreground">Exercício {exerciseIndex + 1} de {log.exercises.length}</p>
              <h2 className="font-heading text-lg font-semibold">{item.exercise.name}</h2>
              <p className="text-sm text-muted-foreground">
                {item.sets} × {formatReps(item.repsMin, item.repsMax)} reps
                {item.loadKg !== null && ` · ${formatNumber(item.loadKg, 2)} kg`}
                {item.restSeconds ? ` · descanso ${formatRest(item.restSeconds)}` : ""}
              </p>
              {item.notes && <p className="text-sm">{item.notes}</p>}
            </div>

            <details className="group rounded-lg bg-muted/50">
              <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                Como executar
                <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <div className="px-3 pb-3">
                <ExerciseDemo name={item.exercise.name} instructions={item.exercise.instructions} videoUrl={item.exercise.videoUrl} />
              </div>
            </details>

            <div className="grid gap-2">
              <div className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 px-1 text-xs text-muted-foreground" aria-hidden>
                <span>Série</span>
                <span>Reps</span>
                <span>Carga (kg)</span>
                <span className="text-center">Feita</span>
              </div>
              {sets[item.id].map((set, index) => {
                const label = `${item.exercise.name}, série ${index + 1}`;
                return (
                  <div
                    key={index}
                    className={cn(
                      "grid grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2 rounded-lg p-1",
                      set.completed && "bg-brand/15 dark:bg-brand/10",
                    )}
                  >
                    <span className="text-center text-sm font-semibold tabular-nums">{index + 1}</span>
                    <input
                      aria-label={`Repetições — ${label}`}
                      inputMode="numeric"
                      placeholder={formatReps(item.repsMin, item.repsMax)}
                      value={set.reps}
                      disabled={set.completed}
                      onChange={(e) => update(item.id, index, { reps: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                      className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 dark:bg-input/30"
                    />
                    <input
                      aria-label={`Carga em kg — ${label}`}
                      inputMode="decimal"
                      placeholder="0"
                      value={set.loadKg}
                      disabled={set.completed}
                      onChange={(e) => update(item.id, index, { loadKg: e.target.value.replace(/[^\d.,]/g, "").slice(0, 7) })}
                      className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 dark:bg-input/30"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant={set.completed ? "default" : "outline"}
                      aria-pressed={set.completed}
                      aria-label={set.completed ? `Desmarcar ${label}` : `Concluir ${label}`}
                      disabled={set.saving}
                      onClick={() => toggle(item, index)}
                      className={cn(set.completed && "bg-brand text-brand-foreground hover:bg-brand/90 dark:glow-brand")}
                    >
                      {set.saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      <FinishWorkout logId={log.id} done={done} planned={planned} />
      {rest && <RestTimer key={rest.endsAt} total={rest.total} endsAt={rest.endsAt} onClose={() => setRest(null)} />}
    </div>
  );
}

function FinishWorkout({ logId, done, planned }: { logId: string; done: number; planned: number }) {
  const [state, action, pending] = useActionState(finishWorkout.bind(null, logId), initialFormState);

  return (
    <section aria-labelledby="finish-title" className="grid gap-4 rounded-xl border bg-card p-4">
      <h2 id="finish-title" className="font-heading text-lg font-semibold">Finalizar treino</h2>
      <form action={action} className="grid gap-4" noValidate>
        <FormMessage state={state} />
        <TextareaField
          name="notes"
          id="finish-notes"
          label="Como foi o treino? (opcional)"
          placeholder="Ex.: senti o joelho no agachamento, aumentei a carga no supino"
          maxLength={1000}
          defaultValue={state.values?.notes}
          errors={state.fieldErrors?.notes}
        />
        {done < planned && (
          <p className="text-sm text-muted-foreground">
            Você concluiu {done} de {planned} séries. Só as séries marcadas como feitas entram no histórico como concluídas.
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton pending={pending} pendingLabel="Salvando…" size="lg">
            Concluir treino
          </SubmitButton>
          <ConfirmAction
            trigger={
              <Button type="button" variant="ghost" size="lg">
                <X aria-hidden />
                Descartar treino
              </Button>
            }
            title="Descartar este treino?"
            description="As séries registradas agora serão apagadas e o treino não entra no histórico."
            confirmLabel="Descartar"
            destructive
            onConfirm={() => discardWorkout(logId)}
          />
        </div>
      </form>
    </section>
  );
}

function RestTimer({ total, endsAt, onClose }: { total: number; endsAt: number; onClose: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const announced = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  useEffect(() => {
    if (remaining === 0 && !announced.current) {
      announced.current = true;
      if ("vibrate" in navigator) navigator.vibrate?.(200);
    }
  }, [remaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg lg:bottom-6"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-brand text-brand-foreground">
        <Timer className="size-5" aria-hidden />
      </span>
      <div className="grid flex-1">
        <span className="text-xs text-muted-foreground">{remaining === 0 ? "Descanso concluído" : `Descanso de ${formatRest(total)}`}</span>
        <span className="font-heading text-2xl font-semibold tabular-nums" aria-live={remaining === 0 ? "assertive" : "off"}>
          {remaining === 0 ? "Próxima série!" : `${minutes}:${seconds}`}
        </span>
      </div>
      <Button variant="ghost" onClick={onClose}>
        {remaining === 0 ? "Fechar" : "Pular"}
      </Button>
    </div>
  );
}
