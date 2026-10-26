"use client";

import { Copy } from "lucide-react";
import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/auth/schemas";
import { duplicatePlan } from "../actions";

type Props = { planId: string; planName: string; students: { id: string; name: string }[]; isTemplate: boolean };

// Saves time: the copy keeps sessions, exercises, cardio and supersets, and
// starts as a draft so it can be adjusted before publishing.
export function DuplicatePlanForm({ planId, planName, students, isTemplate }: Props) {
  const [state, action, pending] = useActionState(duplicatePlan.bind(null, planId), initialFormState);
  const options = [
    ...students.map((s) => ({ value: s.id, label: `Para ${s.name}` })),
    ...(isTemplate ? [] : [{ value: "template", label: "Salvar como modelo" }]),
  ];
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="target" id="duplicate-target" label="Destino" placeholder="Escolha" options={options} defaultValue={state.values?.target ?? ""} errors={state.fieldErrors?.target} />
        <FormField name="name" id="duplicate-name" label="Nome da cópia" placeholder={planName} defaultValue={state.values?.name} errors={state.fieldErrors?.name} hint="Deixe em branco para manter o nome." />
      </div>
      <SubmitButton pending={pending} pendingLabel="Copiando…" className="sm:justify-self-start">
        <Copy aria-hidden />
        {isTemplate ? "Criar plano a partir do modelo" : "Duplicar plano"}
      </SubmitButton>
    </form>
  );
}
