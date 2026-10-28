"use client";

import { Archive, Copy, Ellipsis, FilePen, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { deletePlan, setPlanStatus } from "../actions";
import { DuplicatePlanForm } from "./duplicate-plan-form";

type Props = {
  planId: string;
  planName: string;
  status: PlanStatus;
  studentName: string;
  isTemplate: boolean;
  students: { id: string; name: string }[];
};

type Pending = "draft" | "archive" | "delete" | null;

// The plan's actions, next to its title: the main one (publish) in view,
// duplicating in a dialog, and the rarer or destructive ones in a menu.
export function PlanActions({ planId, planName, status, studentName, isTemplate, students }: Props) {
  const [confirm, setConfirm] = useState<Pending>(null);
  const close = (open: boolean) => !open && setConfirm(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "active" && !isTemplate && (
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

      <Dialog>
        <DialogTrigger
          render={
            <Button variant={isTemplate ? "default" : "secondary"}>
              <Copy aria-hidden />
              {isTemplate ? "Usar modelo" : "Duplicar"}
            </Button>
          }
        />
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{isTemplate ? "Usar este modelo" : "Duplicar plano"}</DialogTitle>
            <DialogDescription>A cópia leva treinos, exercícios, cardio e bi-sets, e começa como rascunho.</DialogDescription>
          </DialogHeader>
          <DuplicatePlanForm planId={planId} planName={planName} isTemplate={isTemplate} students={students} />
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Mais ações do plano" />}>
          <Ellipsis aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {status === "active" && (
            <DropdownMenuItem className="h-10" onClick={() => setConfirm("draft")}>
              <FilePen aria-hidden />
              Voltar para rascunho
            </DropdownMenuItem>
          )}
          {status !== "archived" && !isTemplate && (
            <DropdownMenuItem className="h-10" onClick={() => setConfirm("archive")}>
              <Archive aria-hidden />
              Arquivar
            </DropdownMenuItem>
          )}
          {!isTemplate && <DropdownMenuSeparator />}
          <DropdownMenuItem className="h-10" variant="destructive" onClick={() => setConfirm("delete")}>
            <Trash2 aria-hidden />
            {isTemplate ? "Excluir modelo" : "Excluir plano"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmAction
        open={confirm === "draft"}
        onOpenChange={close}
        title="Voltar para rascunho?"
        description={`${studentName} deixa de ver o plano até você publicar de novo. O histórico registrado é mantido.`}
        confirmLabel="Voltar para rascunho"
        successMessage="Plano despublicado."
        onConfirm={() => setPlanStatus(planId, "draft")}
      />
      <ConfirmAction
        open={confirm === "archive"}
        onOpenChange={close}
        title="Arquivar plano?"
        description="O aluno não poderá mais registrar treinos deste plano, mas o histórico continua disponível."
        confirmLabel="Arquivar"
        successMessage="Plano arquivado."
        onConfirm={() => setPlanStatus(planId, "archived")}
      />
      <ConfirmAction
        open={confirm === "delete"}
        onOpenChange={close}
        title={isTemplate ? "Excluir modelo?" : "Excluir plano?"}
        description={isTemplate ? "O modelo é apagado. Planos já criados a partir dele não mudam." : "O plano e todos os treinos dele serão apagados. Só é possível excluir planos sem treinos registrados."}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => deletePlan(planId)}
      />
    </div>
  );
}
