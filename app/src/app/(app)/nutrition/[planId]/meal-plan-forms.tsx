"use client";

import { Archive, FilePen, Send, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";
import type { PlanStatus } from "@/lib/supabase/database.types";
import { deleteMealPlan, setMealPlanStatus, updateMealPlan } from "../actions";

export function MealPlanDetailsForm({ planId, name, notes }: { planId: string; name: string; notes: string | null }) {
  const [state, action, pending] = useActionState(updateMealPlan.bind(null, planId), initialFormState);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField name="name" id="meal-plan-name" label="Nome do plano" defaultValue={state.values?.name ?? name} errors={state.fieldErrors?.name} />
      <TextareaField name="notes" id="meal-plan-notes" label="Orientações gerais" hint="Visível para o aluno: substituições, hidratação, horários." maxLength={2000} defaultValue={state.values?.notes ?? notes ?? ""} errors={state.fieldErrors?.notes} />
      <SubmitButton pending={pending} pendingLabel="Salvando…" variant="secondary" className="sm:justify-self-start">Salvar plano</SubmitButton>
    </form>
  );
}

export function MealPlanStatusActions({ planId, status, studentName }: { planId: string; status: PlanStatus; studentName: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {status !== "active" && (
        <ConfirmAction
          trigger={<Button><Send aria-hidden />{status === "draft" ? "Publicar para o aluno" : "Reativar plano"}</Button>}
          title="Publicar plano alimentar?"
          description={`${studentName} passa a ver este plano.`}
          confirmLabel="Publicar"
          successMessage="Plano publicado."
          onConfirm={() => setMealPlanStatus(planId, "active")}
        />
      )}
      {status === "active" && (
        <ConfirmAction
          trigger={<Button variant="outline"><FilePen aria-hidden />Voltar para rascunho</Button>}
          title="Voltar para rascunho?"
          description={`${studentName} deixa de ver o plano até você publicar de novo.`}
          confirmLabel="Voltar para rascunho"
          successMessage="Plano despublicado."
          onConfirm={() => setMealPlanStatus(planId, "draft")}
        />
      )}
      {status !== "archived" && (
        <ConfirmAction
          trigger={<Button variant="outline"><Archive aria-hidden />Arquivar</Button>}
          title="Arquivar plano?"
          description="O plano sai da lista de ativos do aluno."
          confirmLabel="Arquivar"
          successMessage="Plano arquivado."
          onConfirm={() => setMealPlanStatus(planId, "archived")}
        />
      )}
      <ConfirmAction
        trigger={<Button variant="destructive"><Trash2 aria-hidden />Excluir plano</Button>}
        title="Excluir plano alimentar?"
        description="O plano e todas as refeições serão apagados. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => deleteMealPlan(planId)}
      />
    </div>
  );
}
