"use client";

import { Archive } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { archiveExercise } from "../actions";

export function ArchiveExerciseButton({ exerciseId, name }: { exerciseId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <Archive aria-hidden />
          Arquivar exercício
        </Button>
      }
      title={`Arquivar ${name}?`}
      description="Ele some da biblioteca e não pode ser adicionado a novos treinos. Planos e históricos que já o usam continuam iguais."
      confirmLabel="Arquivar"
      onConfirm={() => archiveExercise(exerciseId)}
    />
  );
}
