"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/lib/auth/schemas";
import type { PlanDetail } from "@/lib/workouts/queries";
import { updatePlan } from "../actions";

export function PlanDetailsForm({ plan }: { plan: PlanDetail }) {
  const [state, action, pending] = useActionState(updatePlan.bind(null, plan.id), initialFormState);
  const v = state.values;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField name="name" id="plan-name" label="Nome do plano" required defaultValue={v?.name ?? plan.name} errors={state.fieldErrors?.name} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="startsOn" id="plan-startsOn" label="Início" type="date" defaultValue={v?.startsOn ?? plan.startsOn ?? ""} errors={state.fieldErrors?.startsOn} />
        <FormField name="endsOn" id="plan-endsOn" label="Término" type="date" defaultValue={v?.endsOn ?? plan.endsOn ?? ""} errors={state.fieldErrors?.endsOn} />
      </div>
      <TextareaField
        name="notes"
        id="plan-notes"
        label="Orientações gerais"
        hint="Visível para o aluno: aquecimento, frequência, cuidados."
        maxLength={2000}
        defaultValue={v?.notes ?? plan.notes ?? ""}
        errors={state.fieldErrors?.notes}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" variant="secondary" className="sm:justify-self-start">
        Salvar plano
      </SubmitButton>
    </form>
  );
}
