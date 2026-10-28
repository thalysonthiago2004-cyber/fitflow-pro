"use client";

import { Ban, Check, RotateCcw, Trash2, UserX } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type FormState, initialFormState } from "@/lib/auth/schemas";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_TONES, DURATION_OPTIONS } from "@/lib/schedule/schemas";
import { formatMinutes, localDate, localTime, minutesBetween } from "@/lib/schedule/time";
import type { AppointmentStatus } from "@/lib/supabase/database.types";
import { type ActionResult, createAppointment, deleteAppointment, setAppointmentStatus, updateAppointment } from "./actions";

export type DialogAppointment = {
  id: string;
  studentId: string;
  studentName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
};

type Props = {
  students: { id: string; name: string }[];
  /** Editing an existing session; creating a new one otherwise. */
  appointment?: DialogAppointment;
  defaultDate: string;
  trigger: React.ReactElement;
};

export function AppointmentDialog({ students, appointment, defaultDate, trigger }: Props) {
  const [open, setOpen] = useState(false);
  // A new key per opening resets the form to the session's current values.
  const [session, setSession] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSession((n) => n + 1);
        setOpen(next);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{appointment ? "Sessão" : "Nova sessão"}</DialogTitle>
          <DialogDescription>
            {appointment ? (
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={APPOINTMENT_STATUS_TONES[appointment.status]}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</StatusBadge>
                {appointment.studentName}
              </span>
            ) : (
              "Horário de Brasília. O app avisa se você já tiver outra sessão no mesmo horário."
            )}
          </DialogDescription>
        </DialogHeader>
        <AppointmentForm key={session} students={students} appointment={appointment} defaultDate={defaultDate} onDone={() => setOpen(false)} />
        {appointment && <StatusActions appointment={appointment} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AppointmentForm({ students, appointment, defaultDate, onDone }: Omit<Props, "trigger"> & { onDone: () => void }) {
  const action = appointment ? updateAppointment.bind(null, appointment.id) : createAppointment;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, initialFormState);

  // Each result is handled once: onDone changes identity on every render.
  const handled = useRef<FormState | null>(null);
  useEffect(() => {
    if (state.status !== "success" || handled.current === state) return;
    handled.current = state;
    toast.success(state.message);
    onDone();
  }, [state, onDone]);

  const duration = appointment ? minutesBetween(appointment.startsAt, appointment.endsAt) : 60;
  const durations = [...new Set([...DURATION_OPTIONS, duration])].sort((a, b) => a - b);
  const v = (key: string, fallback: string) => state.values?.[key] ?? fallback;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage state={state.status === "error" ? state : initialFormState} />
      <SelectField
        name="studentId"
        id="appointment-student"
        label="Aluno"
        placeholder="Escolha o aluno"
        options={students.map((s) => ({ value: s.id, label: s.name }))}
        defaultValue={v("studentId", appointment?.studentId ?? "")}
        errors={state.fieldErrors?.studentId}
      />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          name="date"
          id="appointment-date"
          label="Data"
          type="date"
          defaultValue={v("date", appointment ? localDate(appointment.startsAt) : defaultDate)}
          errors={state.fieldErrors?.date}
        />
        <FormField
          name="time"
          id="appointment-time"
          label="Início"
          type="time"
          step={300}
          defaultValue={v("time", appointment ? localTime(appointment.startsAt) : "07:00")}
          errors={state.fieldErrors?.time}
        />
      </div>
      <SelectField
        name="duration"
        id="appointment-duration"
        label="Duração"
        options={durations.map((m) => ({ value: String(m), label: formatMinutes(m) }))}
        defaultValue={v("duration", String(duration))}
        errors={state.fieldErrors?.duration}
      />
      <FormField
        name="location"
        id="appointment-location"
        label="Local (opcional)"
        placeholder="Ex.: Academia Central, online"
        maxLength={120}
        defaultValue={v("location", appointment?.location ?? "")}
        errors={state.fieldErrors?.location}
      />
      <TextareaField
        name="notes"
        id="appointment-notes"
        label="Observações (opcional)"
        rows={2}
        maxLength={1000}
        defaultValue={v("notes", appointment?.notes ?? "")}
        errors={state.fieldErrors?.notes}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" size="lg">
        {appointment ? "Salvar alterações" : "Agendar sessão"}
      </SubmitButton>
    </form>
  );
}

function StatusActions({ appointment, onDone }: { appointment: DialogAppointment; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  // Read once per opening: "Realizada" and "Falta" only make sense once it has started.
  const [started] = useState(() => new Date(appointment.startsAt).getTime() <= Date.now());

  function run(task: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await task();
      if (!result.ok) return void toast.error(result.message);
      toast.success(success);
      onDone();
    });
  }

  const when = `${localTime(appointment.startsAt)} com ${appointment.studentName}`;

  return (
    <div className="grid gap-2 border-t pt-4">
      <p className="text-xs font-medium text-muted-foreground">Situação da sessão</p>
      <div className="flex flex-wrap gap-2">
        {appointment.status === "scheduled" && started && (
          <>
            <Button variant="secondary" disabled={pending} onClick={() => run(() => setAppointmentStatus(appointment.id, "completed"), "Sessão marcada como realizada.")}>
              <Check aria-hidden />
              Realizada
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => run(() => setAppointmentStatus(appointment.id, "no_show"), "Falta registrada.")}>
              <UserX aria-hidden />
              Falta
            </Button>
          </>
        )}
        {appointment.status === "scheduled" ? (
          <ConfirmAction
            trigger={
              <Button variant="outline" disabled={pending}>
                <Ban aria-hidden />
                Cancelar sessão
              </Button>
            }
            title="Cancelar esta sessão?"
            description={`A sessão das ${when} fica como cancelada e o horário volta a ficar livre.`}
            confirmLabel="Cancelar sessão"
            successMessage="Sessão cancelada."
            onConfirm={async () => {
              const result = await setAppointmentStatus(appointment.id, "cancelled");
              if (result.ok) onDone();
              return result;
            }}
          />
        ) : (
          <Button variant="outline" disabled={pending} onClick={() => run(() => setAppointmentStatus(appointment.id, "scheduled"), "Sessão reaberta.")}>
            <RotateCcw aria-hidden />
            Reabrir
          </Button>
        )}
        <ConfirmAction
          trigger={
            <Button variant="ghost" disabled={pending} className="text-destructive hover:text-destructive">
              <Trash2 aria-hidden />
              Excluir
            </Button>
          }
          title="Excluir esta sessão?"
          description={`A sessão das ${when} é apagada da agenda. Para manter o histórico, prefira cancelar.`}
          confirmLabel="Excluir"
          destructive
          successMessage="Sessão excluída."
          onConfirm={async () => {
            const result = await deleteAppointment(appointment.id);
            if (result.ok) onDone();
            return result;
          }}
        />
      </div>
    </div>
  );
}
