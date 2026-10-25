"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { initialFormState } from "@/lib/auth/schemas";
import Link from "next/link";
import { updatePassword } from "../actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialFormState);

  if (state.status === "success") {
    return (
      <div className="grid gap-5">
        <FormMessage state={state} />
        <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
          Ir para o painel
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField
        name="password"
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo de 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
      />
      <FormField
        name="confirmPassword"
        label="Confirmar nova senha"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pending={pending} pendingLabel="Salvando…" className="w-full">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
