"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/auth/schemas";
import { login } from "../actions";
import { TextLink } from "../text-link";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialFormState);

  // Read ?next= at submit time instead of during render, so the form stays in
  // the static shell. The server action still sanitizes it.
  function submit(formData: FormData) {
    formData.set("next", new URLSearchParams(window.location.search).get("next") ?? "");
    action(formData);
  }

  return (
    <form action={submit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
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
