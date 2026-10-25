"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/lib/auth/schemas";
import { createMealPlan } from "../actions";

export function NewMealPlanForm({ students, defaultStudentId }: { students: { value: string; label: string }[]; defaultStudentId?: string }) {
  const [state, action, pending] = useActionState(createMealPlan, initialFormState);
  const v = state.values;
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <SelectField name="studentId" label="Aluno" placeholder="Selecione o aluno" options={students} defaultValue={v?.studentId ?? defaultStudentId ?? ""} errors={state.fieldErrors?.studentId} />
      <FormField name="name" label="Nome do plano" placeholder="Ex.: Plano alimentar — novembro" defaultValue={v?.name} errors={state.fieldErrors?.name} />
      <TextareaField name="notes" label="Orientações gerais" maxLength={2000} defaultValue={v?.notes} errors={state.fieldErrors?.notes} />
      <SubmitButton pending={pending} pendingLabel="Criando…" className="sm:justify-self-start">Criar e montar refeições</SubmitButton>
      <p className="text-xs text-muted-foreground">O plano começa como rascunho, com café da manhã, almoço, lanche e jantar para você ajustar.</p>
    </form>
  );
}
