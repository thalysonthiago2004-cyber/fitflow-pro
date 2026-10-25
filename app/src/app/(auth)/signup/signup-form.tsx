"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/auth/schemas";
import { signup } from "../actions";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, initialFormState);

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField
        name="fullName"
        label="Nome completo"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <FormField
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        name="password"
        label="Senha"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo de 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
      />
      <SubmitButton pending={pending} pendingLabel="Criando conta…" className="w-full">
        Criar conta
      </SubmitButton>
    </form>
  );
}
