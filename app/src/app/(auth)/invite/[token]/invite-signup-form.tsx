"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/auth/schemas";
import { signupWithInvite } from "../../actions";

type Props = { token: string; email: string; suggestedName: string };

export function InviteSignupForm({ token, email, suggestedName }: Props) {
  const [state, action, pending] = useActionState(signupWithInvite.bind(null, token), initialFormState);

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField name="email" label="E-mail" type="email" value={email} readOnly disabled hint="Definido pelo convite." />
      <FormField
        name="fullName"
        label="Nome completo"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName ?? suggestedName}
        errors={state.fieldErrors?.fullName}
      />
      <FormField
        name="password"
        label="Crie uma senha"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo de 8 caracteres, com letras e números."
        errors={state.fieldErrors?.password}
      />
      <SubmitButton pending={pending} pendingLabel="Criando conta…" className="w-full">
        Criar conta e aceitar convite
      </SubmitButton>
    </form>
  );
}
