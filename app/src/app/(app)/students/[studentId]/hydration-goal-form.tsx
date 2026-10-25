"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/auth/schemas";
import { formatNumber } from "@/lib/format";
import { setHydrationGoal } from "../actions";

export function HydrationGoalForm({ studentId, goalMl }: { studentId: string; goalMl: number | null }) {
  const [state, action, pending] = useActionState(setHydrationGoal.bind(null, studentId), initialFormState);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_auto] sm:items-start" noValidate>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <FormField
        name="liters"
        id="goal-liters"
        label="Meta diária (litros)"
        inputMode="decimal"
        placeholder="Ex.: 2,5"
        defaultValue={state.values?.liters ?? (goalMl ? formatNumber(goalMl / 1000, 2) : "")}
        errors={state.fieldErrors?.liters}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" variant="secondary" className="sm:mt-7">
        Salvar meta
      </SubmitButton>
    </form>
  );
}
