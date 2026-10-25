"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import type { FieldErrors } from "@/lib/auth/schemas";
import { formatNumber } from "@/lib/format";
import type { StrengthPrescription } from "@/lib/workouts/queries";
import { cn } from "@/lib/utils";

type Props = {
  idPrefix: string;
  values?: Record<string, string>;
  errors?: FieldErrors;
  current?: StrengthPrescription;
};

const SET_OPTIONS = Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const REP_VALUES = [...Array.from({ length: 30 }, (_, i) => i + 1), 35, 40, 45, 50, 60, 70, 80, 90, 100];
const REP_OPTIONS = REP_VALUES.map((n) => ({ value: String(n), label: String(n) }));

// Keeps a saved value selectable even when it is not one of the presets.
function repOptions(current: string) {
  if (!current || REP_OPTIONS.some((o) => o.value === current)) return REP_OPTIONS;
  return [...REP_OPTIONS, { value: current, label: current }].sort((a, b) => Number(a.value) - Number(b.value));
}

const selectClass =
  "h-11 w-full appearance-none rounded-lg border border-input bg-transparent pr-8 pl-3 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 [&>option]:bg-popover";

// Shared inputs for creating and editing a strength exercise. Sets and reps
// are picked, not typed; reps can be one range for every set or one target
// per set (e.g. 12/10/8).
export function PrescriptionFields({ idPrefix, values, errors, current }: Props) {
  const field = (name: string) => `${idPrefix}-${name}`;
  const pick = (key: string, fallback: number | string | null | undefined) =>
    values?.[key] ?? (fallback === null || fallback === undefined ? "" : String(fallback));

  const [sets, setSets] = useState(Number(pick("sets", current?.sets ?? 3)) || 3);
  const [mode, setMode] = useState<"same" | "perSet">(
    (values?.repsMode as "same" | "perSet") ?? (current?.repsPerSet ? "perSet" : "same"),
  );
  const savedPerSet = values?.repsPerSet ? values.repsPerSet.split(",") : current?.repsPerSet?.map(String);
  const [perSet, setPerSet] = useState<string[]>(() => savedPerSet ?? []);
  const repFor = (i: number) => perSet[i] ?? perSet.at(-1) ?? pick("repsMin", current?.repsMin ?? 10);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-4">
        <SelectField
          name="sets"
          id={field("sets")}
          label="Séries"
          options={SET_OPTIONS}
          value={String(sets)}
          onChange={(e) => setSets(Number(e.target.value))}
          errors={errors?.sets}
        />
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

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Repetições</legend>
        <div className="grid grid-cols-2 gap-2 sm:w-fit">
          {(
            [
              ["same", "Mesmas em todas as séries"],
              ["perSet", "Diferentes por série"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                mode === value ? "border-foreground bg-accent" : "text-muted-foreground",
              )}
            >
              <input type="radio" name="repsMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>

        {mode === "same" ? (
          <div className="grid grid-cols-2 items-end gap-4 sm:w-80">
            <SelectField name="repsMin" id={field("repsMin")} label="Reps mín." options={repOptions(pick("repsMin", current?.repsMin))} defaultValue={pick("repsMin", current?.repsMin ?? 10)} errors={errors?.repsMin} />
            <SelectField name="repsMax" id={field("repsMax")} label="Reps máx." placeholder="—" options={repOptions(pick("repsMax", current?.repsMax))} defaultValue={pick("repsMax", current?.repsMax)} errors={errors?.repsMax} />
          </div>
        ) : (
          <div className="grid gap-2">
            <ol className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {Array.from({ length: sets }, (_, i) => {
                const id = field(`reps-set-${i + 1}`);
                return (
                  <li key={i} className="grid gap-1">
                    <label htmlFor={id} className="text-xs text-muted-foreground">Série {i + 1}</label>
                    <div className="relative">
                      <select
                        id={id}
                        name="repsPerSet"
                        value={repFor(i)}
                        onChange={(e) =>
                          setPerSet((current) => {
                            const next = Array.from({ length: sets }, (_, j) => current[j] ?? repFor(j));
                            next[i] = e.target.value;
                            return next;
                          })
                        }
                        aria-invalid={errors?.repsPerSet ? true : undefined}
                        aria-describedby={errors?.repsPerSet ? field("repsPerSet-error") : undefined}
                        className={selectClass}
                      >
                        {repOptions(repFor(i)).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    </div>
                  </li>
                );
              })}
            </ol>
            {errors?.repsPerSet && <p id={field("repsPerSet-error")} className="text-sm text-destructive">{errors.repsPerSet[0]}</p>}
          </div>
        )}
      </fieldset>

      <FormField name="notes" id={field("notes")} label="Observações" placeholder="Ex.: cadência 3-1-1, pegada fechada" defaultValue={pick("notes", current?.notes)} errors={errors?.notes} />
    </div>
  );
}
