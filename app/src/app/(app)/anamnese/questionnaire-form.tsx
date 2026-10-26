"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/lib/auth/schemas";
import { PARQ_DETAILS, PARQ_QUESTIONS, type ParqAnswers } from "@/lib/students/parq";
import { cn } from "@/lib/utils";
import { submitQuestionnaire } from "./actions";

export function QuestionnaireForm({ previous }: { previous: ParqAnswers | null }) {
  const [state, action, pending] = useActionState(submitQuestionnaire, initialFormState);
  const value = (key: string) => state.values?.[key] ?? (previous?.[key as keyof ParqAnswers] as string | null) ?? "";

  return (
    <form action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />
      <ol className="grid gap-4">
        {PARQ_QUESTIONS.map((q, i) => {
          const error = state.fieldErrors?.[q.key]?.[0];
          return (
            <li key={q.key}>
              <fieldset className="grid gap-3 rounded-xl border p-4" aria-describedby={error ? `${q.key}-error` : undefined}>
                <legend className="sr-only">Pergunta {i + 1}</legend>
                <p className="text-sm font-medium"><span className="text-muted-foreground tabular-nums">{i + 1}. </span>{q.text}</p>
                <div className="grid grid-cols-2 gap-2 sm:w-64">
                  {(["no", "yes"] as const).map((option) => (
                    <label key={option} className={cn("flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium has-checked:border-foreground has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50")}>
                      <input type="radio" name={q.key} value={option} defaultChecked={value(q.key) === option} className="sr-only" />
                      {option === "yes" ? "Sim" : "Não"}
                    </label>
                  ))}
                </div>
                {error && <p id={`${q.key}-error`} className="text-sm text-destructive">{error}</p>}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-5">
        {PARQ_DETAILS.map((d) => (
          <TextareaField key={d.key} name={d.key} id={`parq-${d.key}`} label={`${d.label} (opcional)`} placeholder={d.placeholder} maxLength={500} defaultValue={value(d.key)} errors={state.fieldErrors?.[d.key]} />
        ))}
      </div>
      <SubmitButton pending={pending} pendingLabel="Enviando…" className="sm:justify-self-start">Enviar para meu personal</SubmitButton>
    </form>
  );
}
