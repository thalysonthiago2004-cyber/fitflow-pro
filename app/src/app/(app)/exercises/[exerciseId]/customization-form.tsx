"use client";

import { RotateCcw } from "lucide-react";
import { useActionState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";
import type { Exercise } from "@/lib/workouts/queries";
import { resetCustomization, saveCustomization } from "../actions";

// Your own instructions and video link for a catalog exercise. Plans keep
// pointing at the same exercise; only your students see this version.
export function CustomizationForm({ exercise }: { exercise: Exercise }) {
  const [state, action, pending] = useActionState(saveCustomization.bind(null, exercise.id), initialFormState);
  const v = state.values;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <TextareaField
        name="instructions"
        id="custom-instructions"
        label="Instruções de execução"
        maxLength={2000}
        defaultValue={v?.instructions ?? exercise.instructions ?? ""}
        errors={state.fieldErrors?.instructions}
      />
      <FormField
        name="videoUrl"
        id="custom-video-url"
        label="Link do vídeo (opcional)"
        type="url"
        inputMode="url"
        placeholder="https://www.youtube.com/watch?v=…"
        hint="YouTube, Vimeo, TikTok ou Instagram. YouTube e Vimeo aparecem embutidos. Um vídeo enviado tem prioridade sobre o link."
        defaultValue={v?.videoUrl ?? exercise.videoUrl ?? ""}
        errors={state.fieldErrors?.videoUrl}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton pending={pending} pendingLabel="Salvando…">Salvar para meus alunos</SubmitButton>
        {exercise.customized && (
          <ConfirmAction
            trigger={
              <Button type="button" variant="ghost">
                <RotateCcw aria-hidden />
                Voltar ao padrão
              </Button>
            }
            title="Voltar à versão padrão?"
            description="Suas instruções e o vídeo enviado são removidos; seus alunos voltam a ver a versão da biblioteca."
            confirmLabel="Voltar ao padrão"
            successMessage="Exercício restaurado."
            destructive
            onConfirm={() => resetCustomization(exercise.id)}
          />
        )}
      </div>
    </form>
  );
}
