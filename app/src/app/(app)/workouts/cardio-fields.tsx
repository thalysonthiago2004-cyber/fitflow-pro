"use client";

import { useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import type { FieldErrors } from "@/lib/auth/schemas";
import { formatNumber } from "@/lib/format";
import type { CardioMode } from "@/lib/supabase/database.types";
import { CARDIO_MODE_LABELS, INTENSITY_LABELS } from "@/lib/workouts/labels";
import type { CardioTarget } from "@/lib/workouts/queries";
import { cn } from "@/lib/utils";

const INTENSITY_OPTIONS = Object.entries(INTENSITY_LABELS).map(([value, label]) => ({ value, label }));

type Props = {
  idPrefix: string;
  values?: Record<string, string>;
  errors?: FieldErrors;
  current?: CardioTarget;
  notes?: string | null;
};

// Shared inputs for creating and editing a cardio block. The mode decides
// which targets apply; the server drops the others.
export function CardioFields({ idPrefix, values, errors, current, notes }: Props) {
  const [mode, setMode] = useState<CardioMode>((values?.cardioMode as CardioMode) ?? current?.mode ?? "continuous");
  const field = (name: string) => `${idPrefix}-${name}`;
  const pick = (key: string, fallback: number | string | null | undefined) =>
    values?.[key] ?? (fallback === null || fallback === undefined ? "" : String(fallback));
  const decimal = (key: string, fallback: number | null | undefined, digits: number) =>
    values?.[key] ?? (fallback == null ? "" : formatNumber(fallback, digits));

  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Tipo de cardio</legend>
        <div className="grid grid-cols-2 gap-2 sm:w-fit">
          {(Object.keys(CARDIO_MODE_LABELS) as CardioMode[]).map((value) => (
            <label
              key={value}
              className={cn(
                "flex h-11 cursor-pointer items-center justify-center rounded-lg border px-4 text-sm font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                mode === value ? "border-foreground bg-accent" : "text-muted-foreground",
              )}
            >
              <input type="radio" name="cardioMode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              {CARDIO_MODE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "continuous" ? (
        <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-4">
          <FormField name="durationMinutes" id={field("durationMinutes")} label="Duração (min)" inputMode="numeric" defaultValue={pick("durationMinutes", current?.durationMinutes ?? 20)} errors={errors?.durationMinutes} />
          <FormField name="distanceKm" id={field("distanceKm")} label="Distância (km)" inputMode="decimal" hint="Opcional" defaultValue={decimal("distanceKm", current?.distanceKm, 2)} errors={errors?.distanceKm} />
        </div>
      ) : (
        <div className="grid grid-cols-3 items-end gap-4 sm:grid-cols-4">
          <FormField name="rounds" id={field("rounds")} label="Séries" inputMode="numeric" defaultValue={pick("rounds", current?.rounds ?? 8)} errors={errors?.rounds} />
          <FormField name="workSeconds" id={field("workSeconds")} label="Estímulo (s)" inputMode="numeric" defaultValue={pick("workSeconds", current?.workSeconds ?? 30)} errors={errors?.workSeconds} />
          <FormField name="restSeconds" id={field("restSeconds")} label="Descanso (s)" inputMode="numeric" defaultValue={pick("restSeconds", current?.restSeconds ?? 60)} errors={errors?.restSeconds} />
        </div>
      )}

      <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-5">
        <SelectField name="intensity" id={field("intensity")} label="Intensidade" placeholder="Não definida" options={INTENSITY_OPTIONS} defaultValue={pick("intensity", current?.intensity)} errors={errors?.intensity} className="col-span-2 sm:col-span-1" />
        <FormField name="hrMin" id={field("hrMin")} label="FC mín. (bpm)" inputMode="numeric" defaultValue={pick("hrMin", current?.hrMin)} errors={errors?.hrMin} />
        <FormField name="hrMax" id={field("hrMax")} label="FC máx. (bpm)" inputMode="numeric" defaultValue={pick("hrMax", current?.hrMax)} errors={errors?.hrMax} />
        <FormField name="speedKmh" id={field("speedKmh")} label="Velocidade (km/h)" inputMode="decimal" defaultValue={decimal("speedKmh", current?.speedKmh, 1)} errors={errors?.speedKmh} />
        <FormField name="inclinePct" id={field("inclinePct")} label="Inclinação (%)" inputMode="decimal" defaultValue={decimal("inclinePct", current?.inclinePct, 1)} errors={errors?.inclinePct} />
      </div>
      <FormField name="notes" id={field("notes")} label="Observações" placeholder="Ex.: aquecer 5 min antes, carga 8 na bike" defaultValue={pick("notes", notes)} errors={errors?.notes} />
    </div>
  );
}
