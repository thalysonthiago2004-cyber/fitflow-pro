"use client";

import { useTransition } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { formString, validationError } from "@/lib/auth/form-state";
import { loginSchema } from "@/lib/auth/schemas";
import { resendVerification, signInFlow } from "@/lib/firebase/flows";
import { useFlowForm } from "@/lib/firebase/use-flow-form";
import { TextLink } from "../text-link";

export function FirebaseLoginForm() {
  const { state, setState, unverified, pending, run } = useFlowForm();
  const [resending, startResend] = useTransition();

  function submit(formData: FormData) {
    const email = formString(formData, "email");
    const parsed = loginSchema.safeParse({ email, password: formString(formData, "password") });
    if (!parsed.success) return setState(validationError(parsed.error, { email }));
    const next = new URLSearchParams(window.location.search).get("next") ?? "";
    run({ email }, () => signInFlow(parsed.data.email, parsed.data.password, next));
  }

  function resend() {
    startResend(async () => {
      const result = await resendVerification();
      setState({ status: result.ok ? "success" : "error", message: result.message, values: state.values });
    });
  }

  return (
    <form action={submit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      {unverified && (
        <Button type="button" variant="outline" onClick={resend} disabled={resending} aria-busy={resending || undefined}>
          {resending ? "Enviando…" : "Reenviar e-mail de confirmação"}
        </Button>
      )}
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
      <div className="grid gap-2">
        <FormField
          name="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
        />
        <TextLink href="/forgot-password" className="justify-self-end text-sm">
          Esqueci minha senha
        </TextLink>
      </div>
      <SubmitButton pending={pending} pendingLabel="Entrando…" className="w-full">
        Entrar
      </SubmitButton>
    </form>
  );
}
