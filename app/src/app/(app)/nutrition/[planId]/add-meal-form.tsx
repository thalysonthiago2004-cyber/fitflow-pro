"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";
import { addMeal } from "../actions";

export function AddMealForm({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: typeof initialFormState, formData: FormData) => {
    const result = await addMeal(planId, prev, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, initialFormState);

  if (!open) {
    return <Button variant="secondary" className="sm:justify-self-start" onClick={() => setOpen(true)}><Plus aria-hidden />Adicionar refeição</Button>;
  }
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-dashed p-4 sm:p-6" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <FormField name="name" id="new-meal-name" label="Nome da refeição" placeholder="Ex.: Ceia" defaultValue={state.values?.name} errors={state.fieldErrors?.name} />
        <FormField name="timeOfDay" id="new-meal-time" label="Horário" type="time" defaultValue={state.values?.timeOfDay} errors={state.fieldErrors?.timeOfDay} />
      </div>
      <input type="hidden" name="notes" value="" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pending={pending} pendingLabel="Adicionando…">Adicionar refeição</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
