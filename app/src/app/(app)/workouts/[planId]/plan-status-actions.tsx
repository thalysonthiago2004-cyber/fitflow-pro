"use client";

import { Archive, FilePen, Send, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { deletePlan, setPlanStatus } from "../actions";

type Props = { planId: string; status: PlanStatus; studentName: string };

export function PlanStatusActions({ planId, status, studentName }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {status !== "active" && (
        <ConfirmAction
          trigger={
            <Button>
              <Send aria-hidden />
              {status === "draft" ? "Publicar para o aluno" : "Reativar plano"}
            </Button>
          }
          title="Publicar plano?"
          description={`${studentName} passa a ver este plano e pode registrar os treinos.`}
          confirmLabel="Publicar"
          successMessage="Plano publicado."
          onConfirm={() => setPlanStatus(planId, "active")}
        />
      )}
      {status === "active" && (
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <FilePen aria-hidden />
              Voltar para rascunho
            </Button>
          }
          title="Voltar para rascunho?"
          description={`${studentName} deixa de ver o plano até você publicar de novo. O histórico registrado é mantido.`}
          confirmLabel="Voltar para rascunho"
          successMessage="Plano despublicado."
          onConfirm={() => setPlanStatus(planId, "draft")}
        />
      )}
      {status !== "archived" && (
        <ConfirmAction
          trigger={
            <Button variant="outline">
              <Archive aria-hidden />
              Arquivar
            </Button>
          }
          title="Arquivar plano?"
          description="O aluno não poderá mais registrar treinos deste plano, mas o histórico continua disponível."
          confirmLabel="Arquivar"
          successMessage="Plano arquivado."
          onConfirm={() => setPlanStatus(planId, "archived")}
        />
      )}
      <ConfirmAction
        trigger={
          <Button variant="destructive">
            <Trash2 aria-hidden />
            Excluir plano
          </Button>
        }
        title="Excluir plano?"
        description="O plano e todos os treinos dele serão apagados. Só é possível excluir planos sem treinos registrados."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => deletePlan(planId)}
      />
    </div>
  );
}
