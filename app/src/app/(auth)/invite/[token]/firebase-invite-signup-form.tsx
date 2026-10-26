"use client";

import Link from "next/link";
import { ConsentField } from "@/components/forms/consent-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { formString, validationError } from "@/lib/auth/form-state";
import { fullNameSchema, newPasswordSchema } from "@/lib/auth/schemas";
import { signUpFlow } from "@/lib/firebase/flows";
import { useFlowForm } from "@/lib/firebase/use-flow-form";
import { z } from "zod";
import { firebaseSignUpStudent } from "../../firebase-actions";
import { verifyEmailMessage } from "../../signup/firebase-signup-form";

type Props = { token: string; email: string; suggestedName: string };

const inviteSchema = z.object({ fullName: fullNameSchema, password: newPasswordSchema });

export function FirebaseInviteSignupForm({ token, email, suggestedName }: Props) {
  const { state, setState, pending, run } = useFlowForm();

  function submit(formData: FormData) {
    const values = { fullName: formString(formData, "fullName") };
    const parsed = inviteSchema.safeParse({ fullName: values.fullName, password: formString(formData, "password") });
    if (!parsed.success) return setState(validationError(parsed.error, values));
    const consents = { acceptTerms: formData.get("acceptTerms") === "yes", acceptHealth: formData.get("acceptHealth") === "yes" };
    run(
      values,
      () => signUpFlow(email, parsed.data.password, (idToken) =>
        firebaseSignUpStudent(idToken, token, { fullName: parsed.data.fullName, ...consents })),
      verifyEmailMessage,
    );
  }

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={submit} className="grid gap-5" noValidate>
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
      <ConsentField name="acceptTerms" id="invite-accept-terms" errors={state.fieldErrors?.acceptTerms}>
        Li e aceito os <Link href="/termos" target="_blank" className="font-medium text-foreground underline underline-offset-4">termos de uso</Link> e a{" "}
        <Link href="/privacidade" target="_blank" className="font-medium text-foreground underline underline-offset-4">política de privacidade</Link>.
      </ConsentField>
      <ConsentField name="acceptHealth" id="invite-accept-health" errors={state.fieldErrors?.acceptHealth}>
        Autorizo o uso dos meus dados de saúde (peso, medidas, fotos de evolução e registros de treino) para o acompanhamento com meu personal.
      </ConsentField>
      <SubmitButton pending={pending} pendingLabel="Criando conta…" className="w-full">
        Criar conta e aceitar convite
      </SubmitButton>
    </form>
  );
}
