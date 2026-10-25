"use client";

import { Archive } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { archiveFood } from "../actions";

export function ArchiveFoodButton({ foodId, name }: { foodId: string; name: string }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline"><Archive aria-hidden />Arquivar alimento</Button>}
      title={`Arquivar ${name}?`}
      description="Ele some da lista e não pode ser adicionado a novas refeições. Planos que já o usam continuam iguais."
      confirmLabel="Arquivar"
      onConfirm={() => archiveFood(foodId)}
    />
  );
}
