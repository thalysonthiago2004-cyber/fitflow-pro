"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";
import { addSession } from "../actions";
import { WeekdayPicker } from "../weekday-picker";

export function AddSessionForm({ planId, suggestedName }: { planId: string; suggestedName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await addSession(planId, prev, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, initialFormState);

  if (!open) {
    return (
      <Button variant="secondary" className="sm:justify-self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Adicionar treino
      </Button>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-xl border border-dashed p-4 sm:p-6" noValidate>
      <FormMessage state={state} />
      <FormField name="name" id="new-session-name" label="Nome do treino" defaultValue={state.values?.name ?? suggestedName} errors={state.fieldErrors?.name} />
      <WeekdayPicker idPrefix="new-session" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pending={pending} pendingLabel="Adicionando…">Adicionar treino</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
