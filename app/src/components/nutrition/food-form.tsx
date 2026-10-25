"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { type FormState, initialFormState } from "@/lib/auth/schemas";
import { formatNumber } from "@/lib/format";
import type { Food } from "@/lib/nutrition/queries";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  food?: Food;
  submitLabel: string;
};

const BASIS_OPTIONS = [
  { value: "g", label: "Sólido (por 100 g)" },
  { value: "ml", label: "Líquido (por 100 ml)" },
];

export function FoodForm({ action, food, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const v = state.values;
  const n = (value: number | null | undefined) => (value === null || value === undefined ? "" : formatNumber(value, 1));
  const unit = food?.basis ?? "g";

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField name="name" label="Nome" required defaultValue={v?.name ?? food?.name} errors={state.fieldErrors?.name} />
      {food ? (
        <input type="hidden" name="basis" value={food.basis} />
      ) : (
        <SelectField name="basis" label="Tipo" options={BASIS_OPTIONS} defaultValue={v?.basis ?? "g"} errors={state.fieldErrors?.basis} />
      )}

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-medium">Informação nutricional por 100 {food ? unit : "g ou 100 ml"}</legend>
        <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-5">
          <FormField name="kcal" label="Calorias (kcal)" inputMode="decimal" required defaultValue={v?.kcal ?? n(food?.kcalPer100)} errors={state.fieldErrors?.kcal} />
          <FormField name="protein" label="Proteínas (g)" inputMode="decimal" required defaultValue={v?.protein ?? n(food?.proteinPer100)} errors={state.fieldErrors?.protein} />
          <FormField name="carbs" label="Carboidratos (g)" inputMode="decimal" required defaultValue={v?.carbs ?? n(food?.carbsPer100)} errors={state.fieldErrors?.carbs} />
          <FormField name="fat" label="Gorduras (g)" inputMode="decimal" required defaultValue={v?.fat ?? n(food?.fatPer100)} errors={state.fieldErrors?.fat} />
          <FormField name="fiber" label="Fibras (g)" inputMode="decimal" defaultValue={v?.fiber ?? n(food?.fiberPer100)} errors={state.fieldErrors?.fiber} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-medium">Medida caseira (opcional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="unitLabel" label="Nome da medida" placeholder="Ex.: unidade, fatia, colher de sopa" defaultValue={v?.unitLabel ?? food?.unitLabel ?? ""} errors={state.fieldErrors?.unitLabel} />
          <FormField name="unitAmount" label={`Quanto pesa (${food ? unit : "g ou ml"})`} inputMode="decimal" placeholder="Ex.: 50" defaultValue={v?.unitAmount ?? n(food?.unitAmount)} errors={state.fieldErrors?.unitAmount} />
        </div>
      </fieldset>

      <FormField
        name="source"
        label="Fonte dos valores"
        required
        placeholder="Ex.: Rótulo do produto; Tabela TACO 4ª ed."
        hint="Obrigatória para que as estimativas possam ser conferidas."
        defaultValue={v?.source ?? food?.source}
        errors={state.fieldErrors?.source}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">{submitLabel}</SubmitButton>
    </form>
  );
}
