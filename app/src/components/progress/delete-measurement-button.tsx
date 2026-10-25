"use client";

import { Trash2 } from "lucide-react";
import { deleteMeasurement } from "@/app/(app)/progress/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";

export function DeleteMeasurementButton({ measurementId, label }: { measurementId: string; label: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" size="icon" aria-label={`Excluir medição de ${label}`}><Trash2 aria-hidden /></Button>}
      title="Excluir medição?"
      description={`A medição de ${label} será apagada do histórico.`}
      confirmLabel="Excluir"
      successMessage="Medição excluída."
      destructive
      onConfirm={() => deleteMeasurement(measurementId)}
    />
  );
}
