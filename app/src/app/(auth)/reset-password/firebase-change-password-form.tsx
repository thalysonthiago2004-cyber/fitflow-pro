"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { formString, validationError } from "@/lib/auth/form-state";
import { type FormState, initialFormState, resetPasswordSchema } from "@/lib/auth/schemas";
import { changePasswordFlow } from "@/lib/firebase/flows";

// Signed-in password change. Resetting a forgotten password happens on the
// Firebase page opened from the e-mail, which then returns to /login.
export function FirebaseChangePasswordForm({ email }: { email: string }) {
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const currentPassword = formString(formData, "currentPassword");
    const parsed = resetPasswordSchema.safeParse({ password: formString(formData, "password"), confirmPassword: formString(formData, "confirmPassword") });
    if (!parsed.success || !currentPassword) {
      const errors = parsed.success ? { status: "error" as const, message: "Revise os campos destacados.", fieldErrors: {} } : validationError(parsed.error);
      if (!currentPassword) errors.fieldErrors = { ...errors.fieldErrors, currentPassword: ["Informe sua senha atual."] };
      return setState(errors);
    }
    startTransition(async () => {
      const result = await changePasswordFlow(email, currentPassword, parsed.data.password);
      if (result.ok) return setState({ status: "success", message: "Senha atualizada com sucesso." });
      setState(
        result.field
          ? { status: "error", message: "Revise os campos destacados.", fieldErrors: { [result.field]: [result.message] } }
          : { status: "error", message: result.message },
      );
    });
  }

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
    <form action={submit} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <FormField
        name="currentPassword"
        label="Senha atual"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.currentPassword}
      />
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
