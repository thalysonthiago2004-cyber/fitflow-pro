"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/lib/auth/schemas";
import { formatNumber, todayISO } from "@/lib/format";
import { EXPERIENCE_LEVEL_LABELS, SEX_LABELS } from "@/lib/students/schemas";
import type { StudentDetail } from "@/lib/students/queries";
import { updateStudentProfile } from "../actions";

const LEVEL_OPTIONS = Object.entries(EXPERIENCE_LEVEL_LABELS).map(([value, label]) => ({ value, label }));
const SEX_OPTIONS = Object.entries(SEX_LABELS).map(([value, label]) => ({ value, label }));

export function StudentProfileForm({ student }: { student: StudentDetail }) {
  const [state, action, pending] = useActionState(
    updateStudentProfile.bind(null, student.userId),
    initialFormState,
  );
  const v = state.values;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <TextareaField
        name="goal"
        label="Objetivo"
        placeholder="Ex.: ganhar massa muscular, preparar para corrida de 10 km"
        maxLength={500}
        defaultValue={v?.goal ?? student.goal ?? ""}
        errors={state.fieldErrors?.goal}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          name="experienceLevel"
          label="Nível"
          placeholder="Não informado"
          options={LEVEL_OPTIONS}
          defaultValue={v?.experienceLevel ?? student.experienceLevel ?? ""}
          errors={state.fieldErrors?.experienceLevel}
        />
        <SelectField
          name="sex"
          label="Sexo"
          hint="Usado nas fórmulas da avaliação corporal."
          placeholder="Não informado"
          options={SEX_OPTIONS}
          defaultValue={v?.sex ?? student.sex ?? ""}
          errors={state.fieldErrors?.sex}
        />
        <FormField
          name="birthDate"
          label="Data de nascimento"
          type="date"
          min="1900-01-01"
          max={todayISO()}
          defaultValue={v?.birthDate ?? student.birthDate ?? ""}
          errors={state.fieldErrors?.birthDate}
        />
        <FormField
          name="heightCm"
          label="Altura (cm)"
          inputMode="decimal"
          placeholder="Ex.: 172,5"
          defaultValue={v?.heightCm ?? (student.heightCm === null ? "" : formatNumber(student.heightCm))}
          errors={state.fieldErrors?.heightCm}
        />
      </div>
      <TextareaField
        name="limitations"
        label="Lesões e limitações"
        hint="Informações relatadas pelo aluno para orientar os treinos. Não substitui avaliação médica."
        maxLength={1000}
        defaultValue={v?.limitations ?? student.limitations ?? ""}
        errors={state.fieldErrors?.limitations}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">
        Salvar dados
      </SubmitButton>
    </form>
  );
}
