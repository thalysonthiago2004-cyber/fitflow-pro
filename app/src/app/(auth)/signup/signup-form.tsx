"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ConsentField } from "@/components/forms/consent-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/auth/schemas";
import { signup } from "../actions";

export function SignupForm({ betaClosed }: { betaClosed: boolean }) {
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
      {betaClosed && (
        <FormField
          name="betaCode"
          label="Código de acesso do beta"
          autoComplete="off"
          autoCapitalize="characters"
          required
          hint="O FitFlow Pro está em beta fechado. Use o código que você recebeu."
          defaultValue={state.values?.betaCode}
          errors={state.fieldErrors?.betaCode}
        />
      )}
      <ConsentField name="acceptTerms" errors={state.fieldErrors?.acceptTerms}>
        Li e aceito os <Link href="/termos" target="_blank" className="font-medium text-foreground underline underline-offset-4">termos de uso</Link> e a{" "}
        <Link href="/privacidade" target="_blank" className="font-medium text-foreground underline underline-offset-4">política de privacidade</Link>.
      </ConsentField>
      <SubmitButton pending={pending} pendingLabel="Criando conta…" className="w-full">
        Criar conta
      </SubmitButton>
    </form>
  );
}
