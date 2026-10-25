import { FormField } from "@/components/forms/form-field";
import type { FieldErrors } from "@/lib/auth/schemas";
import type { StrengthPrescription } from "@/lib/workouts/queries";
import { formatNumber } from "@/lib/format";

type Props = {
  idPrefix: string;
  values?: Record<string, string>;
  errors?: FieldErrors;
  current?: StrengthPrescription;
};

// Shared inputs for creating and editing a prescribed exercise.
export function PrescriptionFields({ idPrefix, values, errors, current }: Props) {
  const field = (name: string) => `${idPrefix}-${name}`;
  const pick = (key: string, fallback: number | string | null | undefined) =>
    values?.[key] ?? (fallback === null || fallback === undefined ? "" : String(fallback));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-5">
        <FormField name="sets" id={field("sets")} label="Séries" inputMode="numeric" required defaultValue={pick("sets", current?.sets ?? 3)} errors={errors?.sets} />
        <FormField name="repsMin" id={field("repsMin")} label="Reps mín." inputMode="numeric" required defaultValue={pick("repsMin", current?.repsMin ?? 10)} errors={errors?.repsMin} />
        <FormField name="repsMax" id={field("repsMax")} label="Reps máx." inputMode="numeric" defaultValue={pick("repsMax", current?.repsMax)} errors={errors?.repsMax} />
        <FormField
          name="loadKg"
          id={field("loadKg")}
          label="Carga (kg)"
          inputMode="decimal"
          defaultValue={values?.loadKg ?? (current?.loadKg != null ? formatNumber(current.loadKg, 2) : "")}
          errors={errors?.loadKg}
        />
        <FormField name="restSeconds" id={field("restSeconds")} label="Descanso (s)" inputMode="numeric" defaultValue={pick("restSeconds", current?.restSeconds ?? 60)} errors={errors?.restSeconds} />
      </div>
      <FormField name="notes" id={field("notes")} label="Observações" placeholder="Ex.: cadência 3-1-1, pegada fechada" defaultValue={pick("notes", current?.notes)} errors={errors?.notes} />
    </div>
  );
}
