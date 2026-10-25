"use client";

import { useActionState } from "react";
import { addMeasurement } from "@/app/(app)/progress/actions";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialFormState } from "@/lib/auth/schemas";
import { todayISO } from "@/lib/format";
import { fieldsFor } from "@/lib/progress/schemas";
import type { MeasurementSource } from "@/lib/supabase/database.types";

const COPY: Record<MeasurementSource, { hint: string; submit: string }> = {
  manual: {
    hint: "Preencha só o que foi medido. Pescoço, cintura e quadril alimentam a avaliação corporal rápida.",
    submit: "Registrar medição",
  },
  bioimpedance: {
    hint: "Copie os valores exibidos pela balança ou pelo relatório do aparelho. Eles ficam marcados como bioimpedância.",
    submit: "Registrar bioimpedância",
  },
};

function MeasurementForm({ studentId, source }: { studentId: string; source: MeasurementSource }) {
  const [state, action, pending] = useActionState(addMeasurement.bind(null, studentId), initialFormState);
  // React resets the form after each submission; on errors the typed values come back through `values`.
  const v = state.status === "error" ? state.values : undefined;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="source" value={source} />
      <FormMessage state={state} />
      <FormField name="measuredOn" label="Data da medição" type="date" max={todayISO()} defaultValue={v?.measuredOn ?? todayISO()} errors={state.fieldErrors?.measuredOn} className="sm:max-w-56" />
      <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-4">
        {fieldsFor(source).map((f) => (
          <FormField key={f.key} name={f.key} label={f.label} inputMode={"int" in f ? "numeric" : "decimal"} defaultValue={v?.[f.key]} errors={state.fieldErrors?.[f.key]} />
        ))}
      </div>
      <FormField name="notes" label="Observações" placeholder={source === "manual" ? "Ex.: medido em jejum, fita da academia" : "Ex.: balança da academia, modelo do aparelho"} defaultValue={v?.notes} errors={state.fieldErrors?.notes} />
      <p className="text-xs text-muted-foreground">{COPY[source].hint} Os valores ficam registrados com o seu nome.</p>
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="sm:justify-self-start">{COPY[source].submit}</SubmitButton>
    </form>
  );
}

// One form per source; only the active tab is mounted, so field ids stay unique.
export function MeasurementEntry({ studentId }: { studentId: string }) {
  return (
    <Tabs defaultValue="manual" className="gap-5">
      <TabsList className="h-11 w-full sm:w-fit group-data-horizontal/tabs:h-11">
        <TabsTrigger value="manual" className="px-4">Fita métrica e peso</TabsTrigger>
        <TabsTrigger value="bioimpedance" className="px-4">Balança de bioimpedância</TabsTrigger>
      </TabsList>
      <TabsContent value="manual"><MeasurementForm studentId={studentId} source="manual" /></TabsContent>
      <TabsContent value="bioimpedance"><MeasurementForm studentId={studentId} source="bioimpedance" /></TabsContent>
    </Tabs>
  );
}
