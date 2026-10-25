"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/lib/auth/schemas";
import { createPlan } from "../actions";

type Props = { students: { value: string; label: string }[]; defaultStudentId?: string };

export function NewPlanForm({ students, defaultStudentId }: Props) {
  const [state, action, pending] = useActionState(createPlan, initialFormState);
  const v = state.values;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <SelectField
        name="studentId"
        label="Aluno"
        placeholder="Selecione o aluno"
        options={students}
        required
        defaultValue={v?.studentId ?? defaultStudentId ?? ""}
        errors={state.fieldErrors?.studentId}
      />
      <FormField name="name" label="Nome do plano" placeholder="Ex.: Hipertrofia — fase 1" required defaultValue={v?.name} errors={state.fieldErrors?.name} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="startsOn" label="Início" type="date" defaultValue={v?.startsOn} errors={state.fieldErrors?.startsOn} />
        <FormField name="endsOn" label="Término" type="date" defaultValue={v?.endsOn} errors={state.fieldErrors?.endsOn} />
      </div>
      <TextareaField name="notes" label="Orientações gerais" maxLength={2000} defaultValue={v?.notes} errors={state.fieldErrors?.notes} />
      <SubmitButton pending={pending} pendingLabel="Criando…" className="sm:justify-self-start">
        Criar e montar treinos
      </SubmitButton>
      <p className="text-xs text-muted-foreground">O plano começa como rascunho. O aluno só vê depois que você publicar.</p>
    </form>
  );
}
