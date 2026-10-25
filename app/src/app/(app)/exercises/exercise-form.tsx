"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { type FormState, initialFormState } from "@/lib/auth/schemas";
import { equipmentOptions, muscleGroupOptions } from "@/lib/workouts/labels";
import type { Exercise } from "@/lib/workouts/queries";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  exercise?: Exercise;
  submitLabel: string;
};

export function ExerciseForm({ action, exercise, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const v = state.values;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField name="name" label="Nome" required defaultValue={v?.name ?? exercise?.name} errors={state.fieldErrors?.name} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="muscleGroup"
          label="Grupo muscular"
          placeholder="Selecione"
          options={muscleGroupOptions}
          required
          defaultValue={v?.muscleGroup ?? exercise?.muscleGroup ?? ""}
          errors={state.fieldErrors?.muscleGroup}
        />
        <SelectField
          name="equipment"
          label="Equipamento"
          placeholder="Selecione"
          options={equipmentOptions}
          required
          defaultValue={v?.equipment ?? exercise?.equipment ?? ""}
          errors={state.fieldErrors?.equipment}
        />
      </div>
      <TextareaField
        name="instructions"
        label="Instruções de execução"
        maxLength={2000}
        defaultValue={v?.instructions ?? exercise?.instructions ?? ""}
        errors={state.fieldErrors?.instructions}
      />
      <FormField
        name="videoUrl"
        label="Link do vídeo de demonstração"
        type="url"
        inputMode="url"
        placeholder="https://www.youtube.com/watch?v=…"
        hint="Links do YouTube e do Vimeo aparecem embutidos na página."
        defaultValue={v?.videoUrl ?? exercise?.videoUrl ?? ""}
        errors={state.fieldErrors?.videoUrl}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
