"use client";

import { ArrowDown, ArrowUp, HeartPulse, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/auth/schemas";
import { MUSCLE_GROUP_LABELS, formatPrescription, formatWeekdays } from "@/lib/workouts/labels";
import type { Exercise, Prescription, SessionDetail } from "@/lib/workouts/queries";
import {
  addCardio,
  addPrescription,
  deletePrescription,
  deleteSession,
  movePrescription,
  moveSession,
  updateCardio,
  updatePrescription,
  updateSession,
} from "../actions";
import { CardioFields } from "../cardio-fields";
import { PrescriptionFields } from "../prescription-fields";
import { WeekdayPicker } from "../weekday-picker";

type Result = { ok: true } | { ok: false; message: string };

function useMover() {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.message);
    });
  return { pending, run };
}

type SessionCardProps = {
  session: SessionDetail;
  index: number;
  total: number;
  exercises: Pick<Exercise, "id" | "name" | "muscleGroup">[];
};

export function SessionCard({ session, index, total, exercises }: SessionCardProps) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<"strength" | "cardio" | null>(null);
  const strengthExercises = exercises.filter((e) => e.muscleGroup !== "cardio");
  const cardioExercises = exercises.filter((e) => e.muscleGroup === "cardio");
  const mover = useMover();
  const headingId = `session-${session.id}-title`;

  return (
    <section aria-labelledby={headingId} className="grid gap-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 id={headingId} className="font-heading text-lg font-semibold">{session.name}</h3>
          <p className="text-sm text-muted-foreground">{formatWeekdays(session.weekdays)}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={`Mover ${session.name} para cima`} disabled={index === 0 || mover.pending} onClick={() => mover.run(() => moveSession(session.id, "up"))}>
            <ArrowUp aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Mover ${session.name} para baixo`} disabled={index === total - 1 || mover.pending} onClick={() => mover.run(() => moveSession(session.id, "down"))}>
            <ArrowDown aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Editar ${session.name}`} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
            {editing ? <X aria-hidden /> : <Pencil aria-hidden />}
          </Button>
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Excluir ${session.name}`}>
                <Trash2 aria-hidden />
              </Button>
            }
            title={`Excluir ${session.name}?`}
            description="Os exercícios deste treino também serão removidos."
            confirmLabel="Excluir"
            successMessage="Treino excluído."
            destructive
            onConfirm={() => deleteSession(session.id)}
          />
        </div>
      </div>

      {editing && <SessionEditForm session={session} onDone={() => setEditing(false)} />}

      {session.exercises.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum exercício neste treino ainda.</p>
      ) : (
        <ol className="grid gap-2">
          {session.exercises.map((item, i) => (
            <PrescriptionRow key={item.id} item={item} index={i} total={session.exercises.length} />
          ))}
        </ol>
      )}

      {adding ? (
        <AddPrescriptionForm
          kind={adding}
          sessionId={session.id}
          exercises={adding === "cardio" ? cardioExercises : strengthExercises}
          onCancel={() => setAdding(null)}
        />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setAdding("strength")}>
            <Plus aria-hidden />
            Adicionar exercício
          </Button>
          <Button variant="outline" onClick={() => setAdding("cardio")}>
            <HeartPulse aria-hidden />
            Adicionar cardio
          </Button>
        </div>
      )}
    </section>
  );
}

function SessionEditForm({ session, onDone }: { session: SessionDetail; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await updateSession(session.id, prev, formData);
    if (result.status === "success") onDone();
    return result;
  }, initialFormState);

  return (
    <form action={action} className="grid gap-4 rounded-lg bg-muted/50 p-4" noValidate>
      <FormMessage state={state} />
      <FormField name="name" id={`session-${session.id}-name`} label="Nome do treino" defaultValue={state.values?.name ?? session.name} errors={state.fieldErrors?.name} />
      <WeekdayPicker idPrefix={`session-${session.id}`} defaultValue={session.weekdays} />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">Salvar treino</SubmitButton>
    </form>
  );
}

function PrescriptionRow({ item, index, total }: { item: Prescription; index: number; total: number }) {
  const [editing, setEditing] = useState(false);
  const mover = useMover();
  const summary = formatPrescription(item);

  return (
    <li className="grid gap-3 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums" aria-hidden>{index + 1}</span>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {item.exercise.name}
              {item.kind === "cardio" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <HeartPulse className="size-3.5" aria-hidden />
                  Cardio
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">{summary}</p>
            {item.notes && <p className="text-sm">{item.notes}</p>}
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-0.5 border-t pt-1 sm:border-0 sm:pt-0">
          <Button variant="ghost" size="icon" aria-label={`Mover ${item.exercise.name} para cima`} disabled={index === 0 || mover.pending} onClick={() => mover.run(() => movePrescription(item.id, "up"))}>
            <ArrowUp aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Mover ${item.exercise.name} para baixo`} disabled={index === total - 1 || mover.pending} onClick={() => mover.run(() => movePrescription(item.id, "down"))}>
            <ArrowDown aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Editar ${item.exercise.name}`} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
            {editing ? <X aria-hidden /> : <Pencil aria-hidden />}
          </Button>
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Remover ${item.exercise.name}`}>
                <Trash2 aria-hidden />
              </Button>
            }
            title={`Remover ${item.exercise.name}?`}
            description="O exercício sai deste treino."
            confirmLabel="Remover"
            successMessage="Exercício removido."
            destructive
            onConfirm={() => deletePrescription(item.id)}
          />
        </div>
      </div>
      {editing && <PrescriptionEditForm item={item} onDone={() => setEditing(false)} />}
    </li>
  );
}

function PrescriptionEditForm({ item, onDone }: { item: Prescription; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await (item.kind === "cardio" ? updateCardio : updatePrescription)(item.id, prev, formData);
    if (result.status === "success") onDone();
    return result;
  }, initialFormState);

  return (
    <form action={action} className="grid gap-4 rounded-lg bg-muted/50 p-3" noValidate>
      <FormMessage state={state} />
      {item.kind === "cardio" ? (
        <CardioFields idPrefix={`item-${item.id}`} values={state.values} errors={state.fieldErrors} current={item.cardio} notes={item.notes} />
      ) : (
        <PrescriptionFields idPrefix={`item-${item.id}`} values={state.values} errors={state.fieldErrors} current={item} />
      )}
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">{item.kind === "cardio" ? "Salvar cardio" : "Salvar exercício"}</SubmitButton>
    </form>
  );
}

function AddPrescriptionForm({
  kind,
  sessionId,
  exercises,
  onCancel,
}: {
  kind: "strength" | "cardio";
  sessionId: string;
  exercises: Pick<Exercise, "id" | "name" | "muscleGroup">[];
  onCancel: () => void;
}) {
  const [round, setRound] = useState(0);
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await (kind === "cardio" ? addCardio : addPrescription)(sessionId, prev, formData);
    if (result.status === "success") {
      toast.success(kind === "cardio" ? "Cardio adicionado." : "Exercício adicionado.");
      setRound((r) => r + 1);
      return initialFormState;
    }
    return result;
  }, initialFormState);

  const groups = Object.entries(MUSCLE_GROUP_LABELS)
    .map(([group, label]) => ({ label, items: exercises.filter((e) => e.muscleGroup === group) }))
    .filter((g) => g.items.length > 0);
  const selectId = `add-${sessionId}-${kind}-exercise`;
  const exerciseError = state.fieldErrors?.exerciseId?.[0];

  return (
    <form key={round} action={action} className="grid gap-4 rounded-lg border border-dashed p-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-2">
        <Label htmlFor={selectId}>{kind === "cardio" ? "Atividade de cardio" : "Exercício"}</Label>
        <select
          id={selectId}
          name="exerciseId"
          defaultValue={state.values?.exerciseId ?? ""}
          aria-invalid={exerciseError ? true : undefined}
          aria-describedby={exerciseError ? `${selectId}-error` : undefined}
          className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 [&_option]:bg-popover"
        >
          <option value="">{kind === "cardio" ? "Selecione a atividade" : "Selecione um exercício"}</option>
          {kind === "cardio"
            ? exercises.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)
            : groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
                  ))}
                </optgroup>
              ))}
        </select>
        {exerciseError && <p id={`${selectId}-error`} className="text-sm text-destructive">{exerciseError}</p>}
      </div>
      {kind === "cardio" ? (
        <CardioFields idPrefix={`add-${sessionId}-cardio`} values={state.values} errors={state.fieldErrors} />
      ) : (
        <PrescriptionFields idPrefix={`add-${sessionId}`} values={state.values} errors={state.fieldErrors} />
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pending={pending} pendingLabel="Adicionando…">Adicionar ao treino</SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>Fechar</Button>
      </div>
    </form>
  );
}
