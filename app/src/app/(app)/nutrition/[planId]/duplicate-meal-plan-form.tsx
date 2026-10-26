"use client";

import { Copy } from "lucide-react";
import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/auth/schemas";
import { duplicateMealPlan } from "../actions";

// The copy keeps meals, times and foods, and starts as a draft so quantities
// can be adjusted to the new student before publishing.
export function DuplicateMealPlanForm({ planId, planName, students }: { planId: string; planName: string; students: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(duplicateMealPlan.bind(null, planId), initialFormState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="target" id="duplicate-meal-target" label="Para qual aluno" placeholder="Escolha" options={students.map((s) => ({ value: s.id, label: s.name }))} defaultValue={state.values?.target ?? ""} errors={state.fieldErrors?.target} />
        <FormField name="name" id="duplicate-meal-name" label="Nome da cópia" placeholder={planName} defaultValue={state.values?.name} errors={state.fieldErrors?.name} hint="Deixe em branco para manter o nome." />
      </div>
      <SubmitButton pending={pending} pendingLabel="Copiando…" className="sm:justify-self-start">
        <Copy aria-hidden />
        Duplicar plano alimentar
      </SubmitButton>
    </form>
  );
}
