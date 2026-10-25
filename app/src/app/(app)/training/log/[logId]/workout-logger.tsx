"use client";

import { Check, ChevronDown, HeartPulse, Layers, LoaderCircle, Timer, X } from "lucide-react";
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
import { formatPrescription, formatRest, formatSetReps, groupSupersets, repsForSet, supersetLabel } from "@/lib/workouts/labels";
import type { LogDetail, Prescription, StrengthPrescription } from "@/lib/workouts/queries";
import { cn } from "@/lib/utils";
import { discardWorkout, finishWorkout, saveSet } from "../../actions";
import { CardioBlock, type CardioStatus } from "./cardio-block";

type SetState = { reps: string; loadKg: string; completed: boolean; saving: boolean };

function initialSets(log: LogDetail): Record<string, SetState[]> {
  return Object.fromEntries(
    log.exercises.flatMap((item) => (item.kind === "strength" ? [item] : [])).map((item) => [
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
  const [cardio, setCardio] = useState<Record<string, CardioStatus>>(() =>
    Object.fromEntries(
      log.exercises
        .filter((item) => item.kind === "cardio")
        .map((item) => [item.id, { completed: log.cardio.find((c) => c.sessionExerciseId === item.id)?.completed ?? false, saving: false }]),
    ),
  );
  // `run` restarts the timer when another rest of the same length begins.
  const [rest, setRest] = useState<{ total: number; run: number } | null>(null);

  // Each strength set and each cardio block is one step of the workout.
  const steps = [...Object.values(sets).flat(), ...Object.values(cardio)];
  const done = steps.filter((s) => s.completed).length;
  const planned = steps.length;
  const saving = steps.some((s) => s.saving);
  const unit = Object.keys(cardio).length > 0 ? "etapas" : "séries";

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

  // restAfter: rest to start once this set is done (null inside a superset round).
  async function toggle(item: StrengthPrescription, index: number, restAfter: number | null) {
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
    if (completed && restAfter) setRest((current) => ({ total: restAfter, run: (current?.run ?? 0) + 1 }));
  }

  return (
    <div className="grid gap-6 pb-24">
      <div className="sticky top-16 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border lg:top-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Progresso</span>
          <span className="tabular-nums text-muted-foreground" aria-live="polite">{done} de {planned} {unit}</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--meter-track)]"
          role="progressbar"
          aria-label={unit === "etapas" ? "Etapas concluídas" : "Séries concluídas"}
          aria-valuemin={0}
          aria-valuemax={planned}
          aria-valuenow={done}
        >
          <div className="h-full rounded-full bg-[var(--meter-fill)] transition-[width] motion-reduce:transition-none dark:shadow-[0_0_10px_rgb(183_243_74/0.6)]" style={{ width: `${planned ? (done / planned) * 100 : 0}%` }} />
        </div>
      </div>

      <ol className="grid gap-4">
        {groupSupersets(log.exercises).map((block) => {
          if (block.length === 1) {
            const item = block[0];
            const exerciseIndex = log.exercises.indexOf(item);
            return (
              <li key={item.id} className="grid gap-4 rounded-3xl border bg-card p-4 sm:p-5">
                <div className="grid gap-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {item.kind === "cardio" && <HeartPulse className="size-3.5" aria-hidden />}
                    {item.kind === "cardio" ? "Cardio" : "Exercício"} {exerciseIndex + 1} de {log.exercises.length}
                  </p>
                  <h2 className="font-heading text-lg font-semibold">{item.exercise.name}</h2>
                  <p className="text-sm text-muted-foreground">{item.kind === "cardio" ? `Meta: ${formatPrescription(item)}` : targetLine(item, true)}</p>
                  {item.notes && <p className="text-sm">{item.notes}</p>}
                </div>
                <HowTo item={item} />
                {item.kind === "cardio" ? (
                  <CardioBlock
                    logId={log.id}
                    item={item}
                    saved={log.cardio.find((c) => c.sessionExerciseId === item.id)}
                    onStatus={(status) => setCardio((current) => ({ ...current, [item.id]: status }))}
                  />
                ) : (
                  <div className="grid gap-2">
                    <SetHeader first="Série" />
                    {sets[item.id].map((set, index) => (
                      <SetRow
                        key={index}
                        item={item}
                        index={index}
                        set={set}
                        rowLabel={String(index + 1)}
                        onChange={(patch) => update(item.id, index, patch)}
                        onToggle={() => toggle(item, index, item.restSeconds)}
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          }

          // Superset: rounds interleave the exercises; rest comes after the last one in each round.
          const group = block as StrengthPrescription[];
          const rounds = Math.max(...group.map((i) => i.sets));
          const groupRest = group.at(-1)!.restSeconds;
          return (
            <li key={group[0].id} className="grid gap-4 rounded-3xl border-2 border-foreground/15 bg-card p-4 sm:p-5">
              <div className="grid gap-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Layers className="size-3.5" aria-hidden />
                  {supersetLabel(group.length)} · exercícios {log.exercises.indexOf(group[0]) + 1}–{log.exercises.indexOf(group.at(-1)!) + 1} de {log.exercises.length}
                </p>
                <h2 className="font-heading text-lg font-semibold">{group.map((i) => i.exercise.name).join(" + ")}</h2>
                <p className="text-sm text-muted-foreground">
                  Em sequência, sem pausa{groupRest ? ` · descanso ${formatRest(groupRest)} ao fim da volta` : ""}
                </p>
              </div>
              <ul className="grid gap-2">
                {group.map((item) => (
                  <li key={item.id} className="grid gap-1 rounded-lg border p-3">
                    <p className="font-medium">{item.exercise.name}</p>
                    <p className="text-sm text-muted-foreground">{targetLine(item, false)}</p>
                    {item.notes && <p className="text-sm">{item.notes}</p>}
                    <HowTo item={item} />
                  </li>
                ))}
              </ul>
              {Array.from({ length: rounds }, (_, round) => {
                const inRound = group.filter((item) => item.sets > round);
                return (
                  <div key={round} className="grid gap-2">
                    <p className="text-sm font-semibold">Volta {round + 1}</p>
                    <SetHeader first="Exercício" />
                    {inRound.map((item, position) => (
                      <SetRow
                        key={item.id}
                        item={item}
                        index={round}
                        set={sets[item.id][round]}
                        rowLabel={item.exercise.name}
                        onChange={(patch) => update(item.id, round, patch)}
                        onToggle={() => toggle(item, round, position === inRound.length - 1 ? groupRest : null)}
                      />
                    ))}
                  </div>
                );
              })}
            </li>
          );
        })}
      </ol>

      <FinishWorkout logId={log.id} done={done} planned={planned} unit={unit} />
      {rest && <RestTimer key={rest.run} total={rest.total} onClose={() => setRest(null)} />}
    </div>
  );
}

type SetRowProps = {
item: StrengthPrescription;
index: number;
set: SetState;
rowLabel: string;
onChange: (patch: Partial<SetState>) => void;
onToggle: () => void;
};

function SetRow({ item, index, set, rowLabel, onChange, onToggle }: SetRowProps) {
  const label = `${item.exercise.name}, série ${index + 1}`;
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(3rem,auto)_minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2 rounded-lg p-1",
        set.completed && "bg-brand/15 dark:bg-brand/10",
      )}
    >
      <span className={cn("text-sm font-semibold tabular-nums", rowLabel.length > 2 ? "max-w-28 truncate text-xs" : "text-center")}>{rowLabel}</span>
      <input
        aria-label={`Repetições — ${label}`}
        inputMode="numeric"
        placeholder={repsForSet(item, index + 1)}
        value={set.reps}
        disabled={set.completed}
        onChange={(e) => onChange({ reps: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 dark:bg-input/30"
      />
      <input
        aria-label={`Carga em kg — ${label}`}
        inputMode="decimal"
        placeholder="0"
        value={set.loadKg}
        disabled={set.completed}
        onChange={(e) => onChange({ loadKg: e.target.value.replace(/[^\d.,]/g, "").slice(0, 7) })}
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70 dark:bg-input/30"
      />
      <Button
        type="button"
        size="icon"
        variant={set.completed ? "default" : "outline"}
        aria-pressed={set.completed}
        aria-label={set.completed ? `Desmarcar ${label}` : `Concluir ${label}`}
        disabled={set.saving}
        onClick={onToggle}
        className={cn(set.completed && "bg-brand text-brand-foreground hover:bg-brand/90 dark:glow-brand")}
      >
        {set.saving ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
      </Button>
    </div>
  );
}

function targetLine(item: StrengthPrescription, withRest: boolean) {
  return [
    `${item.sets} × ${formatSetReps(item)} reps`,
    item.loadKg !== null ? `${formatNumber(item.loadKg, 2)} kg` : null,
    withRest && item.restSeconds ? `descanso ${formatRest(item.restSeconds)}` : null,
  ].filter(Boolean).join(" · ");
}

function SetHeader({ first }: { first: string }) {
  return (
    <div className="grid grid-cols-[minmax(3rem,auto)_minmax(0,1fr)_minmax(0,1fr)_3rem] gap-2 px-1 text-xs text-muted-foreground" aria-hidden>
      <span>{first}</span>
      <span>Reps</span>
      <span>Carga (kg)</span>
      <span className="text-center">Feita</span>
    </div>
  );
}

function HowTo({ item }: { item: Prescription }) {
  return (
    <details className="group rounded-lg bg-muted/50">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Como executar<span className="sr-only"> {item.exercise.name}</span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className="px-3 pb-3">
        <ExerciseDemo name={item.exercise.name} instructions={item.exercise.instructions} videoUrl={item.exercise.videoUrl} videoSrc={item.exercise.videoSrc} />
      </div>
    </details>
  );
}

function FinishWorkout({ logId, done, planned, unit }: { logId: string; done: number; planned: number; unit: string }) {
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
            Você concluiu {done} de {planned} {unit}. Só o que foi marcado como feito entra no histórico como concluído.
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

function RestTimer({ total, onClose }: { total: number; onClose: () => void }) {
  // Fixed when the timer mounts; a new rest remounts it through its key.
  const [endsAt] = useState(() => Date.now() + total * 1000);
  const [remaining, setRemaining] = useState(total);
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
